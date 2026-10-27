window.__ModuleLoader__.load({
	id: "dsh-setting-restart",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region dsh-setting-restart/RestartRow.module.css
		const css = ".dsrs_row{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.dsrs_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.dsrs_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.dsrs_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.dsrs_button{background:var(--dsw-alias-bg-module-platform);height:36px;flex:none;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-family:inherit;font-size:14px;line-height:22px;display:inline-flex}.dsrs_button:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsrs_button:disabled{cursor:default;opacity:.5}.dsrs_connected{color:var(--dsw-alias-state-success-primary)}.dsrs_failure{max-width:200px;color:var(--dsw-alias-state-error-primary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}";
		const tagId = "dsh-setting-restart/RestartRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-setting-restart";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var styles = {
			"row": "dsrs_row",
			"rowText": "dsrs_rowText",
			"title": "dsrs_title",
			"desc": "dsrs_desc",
			"button": "dsrs_button",
			"connected": "dsrs_connected",
			"failure": "dsrs_failure"
		};
		//#endregion
		//#region dsh-setting-restart/locales.js
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"row.title": "一键重启",
			"row.description": "重启 DSH 服务；重启期间本页面会自动重新连接。",
			"row.button": "重启",
			"row.restarting": "正在重启…",
			"row.reconnecting": "重启完成，正在重新连接…",
			"row.connected": "连接成功",
			"row.failed": "重启失败"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"row.title": "One-click restart",
			"row.description": "Restart the DSH service; this page reconnects automatically.",
			"row.button": "Restart",
			"row.restarting": "Restarting…",
			"row.reconnecting": "Restarted, reconnecting…",
			"row.connected": "Connected",
			"row.failed": "Restart failed"
		};
		//#endregion
		//#region dsh-setting-restart/RestartRow.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "setting-restart";
		/** Required services: the slot registry, the locale face, and the connection RPC carrier. */
		const inject = ["slots", "locale", "connection"];
		/** How long "正在重启…" shows before the host process actually exits. */
		const RESTARTING_HOLD_MS = 3000;
		/** How long the "连接成功" state stays visible before the button resets. */
		const CONNECTED_HOLD_MS = 4000;
		/**
		 * General Settings row pinned at the bottom of the page: one click
		 * asks the host to restart the DSH service. The row watches the
		 * runtime's `connection/reset` event (fired on every (re)connect) so a
		 * successful reconnect flips the state to "连接成功" instead of
		 * leaving the button stuck on "正在重新连接…".
		 * @param props - composed Settings slot props.
		 * @returns the restart row.
		 */
		function RestartRow({ restart, onReconnect, t }) {
			const [phase, setPhaseState] = react.useState("idle");
			const [failure, setFailure] = react.useState(null);
			const phaseRef = react.useRef("idle");
			const timers = react.useRef([]);
			const setPhase = (next) => {
				phaseRef.current = next;
				setPhaseState(next);
			};
			const later = (fn, ms) => {
				timers.current.push(setTimeout(fn, ms));
			};
			react.useEffect(() => () => {
				for (const timer of timers.current) clearTimeout(timer);
			}, []);
			react.useEffect(() => onReconnect(() => {
				if (phaseRef.current !== "restarting" && phaseRef.current !== "reconnecting") return;
				setPhase("connected");
				later(() => setPhase("idle"), CONNECTED_HOLD_MS);
			}), [onReconnect]);
			const onClick = () => {
				if (phaseRef.current !== "idle") return;
				setPhase("restarting");
				setFailure(null);
				restart().then((response) => {
					if (response.ok && response.value?.ok === true) {
						later(() => setPhase("reconnecting"), RESTARTING_HOLD_MS);
						return;
					}
					const message = response.ok ? response.value?.error?.message : response.error?.message;
					setPhase("idle");
					setFailure(message && message.length > 0 ? message : t("row.failed"));
				}, (error) => {
					setPhase("idle");
					setFailure(error instanceof Error ? error.message : t("row.failed"));
				});
			};
			const busy = phase === "restarting" || phase === "reconnecting";
			const label = phase === "connected" ? t("row.connected") : phase === "reconnecting" ? t("row.reconnecting") : phase === "restarting" ? t("row.restarting") : t("row.button");
			return (0, react_jsx_runtime.jsxs)("div", {
				className: styles.row,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: styles.rowText,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: styles.title,
								children: t("row.title")
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: styles.desc,
								children: t("row.description")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: phase === "connected" ? styles.button + " " + styles.connected : styles.button,
						disabled: busy,
						onClick: onClick,
						children: label
					}),
					failure === null ? null : (0, react_jsx_runtime.jsx)("span", {
						className: styles.failure,
						role: "status",
						children: failure
					})
				]
			});
		}
		//#endregion
		//#region dsh-setting-restart/index.js
		/**
		 * Browser face: the General Settings restart row. The host invocation
		 * is called directly over the connection RPC carrier (the strict
		 * endpoint is registered by this package's `./typert` host manifest).
		 * `onReconnect` bridges the runtime's `connection/reset` event so the
		 * row can confirm a successful reconnect.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "setting-restart: dictionaries");
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "setting-restart",
				order: Number.MAX_SAFE_INTEGER,
				locale: NS,
				inject: () => ({
					restart: (signal) => ctx.connection.rpc.call("/api", "settingRestart/restart", { args: {} }, signal),
					onReconnect: (listener) => ctx.on("connection/reset", listener)
				})
			}, RestartRow));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
