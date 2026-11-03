import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Send audio bytes across the host/container filesystem boundary.
export function createVoiceRecord(sendPath) {
  return { type: 'record', data: { file: 'base64://' + fs.readFileSync(sendPath).toString('base64') } };
}

export function createStickerCollector(host) {
  const { captureSendGuard, getSocialV2State, fetchOneBotImage, fetchFaceMedia,
    mimeFromBuffer, cfg, syncStickerLibrary, findSticker, bot, sleep,
    applyStickerNoteV2, v2ToolEnabled, setStickerRemarkV2, stickerForScope, log } = host;
return async function collectStickerV2(key, messageRef, remark) {
    const assertSendAllowed = captureSendGuard(key, { ai: true, count: false });
    const st = getSocialV2State(key);
    const found = (st.recentMessages || []).find((m) => m && (String(m.seq) === String(messageRef) || (m.messageId && String(m.messageId) === String(messageRef))));
    if (!found) throw new Error('找不到这条消息，请确认 messageId/seq 有效且属于当前会话');
    if (found.isSelf) throw new Error('不能收藏自己发的表情，只能收藏群友发的');
    const mediaList = Array.isArray(found.media) ? found.media : [];
    if (!mediaList.length) throw new Error('这条消息没有可收藏的图片/表情');
    const media = mediaList[0];
    let file = '';
    if (media?.kind === 'image') {
      // 优先取图片字节转 base64，避免 SnowLuma 直接下载聊天图片 URL 失败（带签名/防盗链）。
      // 严禁把消息里的原始 media.url / media.file 直接交给 OneBot 去下载：那会绕过 SSRF/本地文件防护。
      const img = await fetchOneBotImage(media);
      if (img?.buffer) {
        file = 'base64://' + img.buffer.toString('base64');
      } else {
        throw new Error('无法安全获取该图片字节，已拒绝收藏');
      }
    } else if (media?.kind === 'face') {
      const face = await fetchFaceMedia(media);
      if (face?.buffer) file = 'base64://' + face.buffer.toString('base64');
    }
    if (!file) throw new Error('无法获取该表情的图片源');
    const imageBytes = Buffer.from(file.slice('base64://'.length), 'base64');
    const imageMd5 = crypto.createHash('md5').update(imageBytes).digest('hex').toUpperCase();
    const shared = cfg.snowluma?.sharedMedia;
    if (shared?.hostDir || shared?.gatewayDir) {
      if (!shared.hostDir || !shared.gatewayDir) throw new Error('Shared media paths are incomplete');
      const mime = mimeFromBuffer(imageBytes);
      const extensions = { 'image/png': '.png', 'image/gif': '.gif',
        'image/jpeg': '.jpg', 'image/webp': '.webp' };
      const ext = extensions[mime];
      if (!ext) throw new Error('Unsupported sticker image format');
      const localRoot = path.resolve(shared.hostDir);
      fs.mkdirSync(localRoot, { recursive: true, mode: 0o750 });
      const name = crypto.createHash('sha256').update(imageBytes).digest('hex') + ext;
      const localFile = path.join(localRoot, name);
      if (fs.existsSync(localFile)) {
        if (!fs.lstatSync(localFile).isFile()
          || crypto.createHash('md5').update(fs.readFileSync(localFile)).digest('hex').toUpperCase() !== imageMd5) {
          throw new Error('Shared sticker cache validation failed');
        }
      } else fs.writeFileSync(localFile, imageBytes, { flag: 'wx', mode: 0o640 });
      file = path.posix.join(String(shared.gatewayDir), name);
    }
    const maxRemarkChars = Math.max(1, Number(cfg.socialV2?.sticker?.collect?.maxRemarkChars) || 20);
    const cleanRemark = String(remark ?? '').trim().slice(0, maxRemarkChars);
    const before = await syncStickerLibrary(false);
    let entry = findSticker(before?.entries ?? host.stickerEntries, imageMd5);
    if (!entry) {
      assertSendAllowed();
      const addRes = await bot.request('add_custom_face', { file });
      if (!addRes || addRes.status !== 'ok' || addRes.retcode !== 0
        || (addRes.data?.result !== undefined && Number(addRes.data.result) !== 0)) {
        throw new Error('add_custom_face failed: ' +
          (addRes?.wording || addRes?.data?.errMsg || addRes?.retcode || 'native failure'));
      }
      const returnedId = String(addRes.data?.emoji_id || addRes.data?.emojiId || addRes.data?.resId || '');
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await sleep(350);
        const synced = await syncStickerLibrary(true);
        entry = findSticker(synced?.entries ?? host.stickerEntries, imageMd5)
          || (returnedId ? findSticker(synced?.entries ?? host.stickerEntries, returnedId) : null);
        if (entry) break;
      }
      if (!entry) throw new Error('Sticker added but not yet visible in favorites; check the library before retrying');
    }
    const emojiId = entry.id;
    // Keep the requested description in local AI notes even when official renaming is disabled.
    if (cleanRemark) {
      entry = applyStickerNoteV2(emojiId, cleanRemark, undefined, undefined, key) || entry;
      if (v2ToolEnabled('setStickerRemark')) {
        try {
          assertSendAllowed();
          entry = await setStickerRemarkV2(emojiId, cleanRemark) || entry;
        } catch (error) {
          log('[sticker] official remark unavailable; local note saved: ' + (error?.message ?? error));
        }
      }
    }
    return { emojiId, entry: stickerForScope(entry, key), remark: cleanRemark, verified: true };
  };
}
