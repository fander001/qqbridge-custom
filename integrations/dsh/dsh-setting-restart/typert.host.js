/**
 * dsh-setting-restart — generated-style Typert host manifest.
 *
 * The typert-loader discovers this file through the package's `./typert`
 * export and registers the strict invocation into the host registry; the
 * api-gateway then routes `POST /api/settingRestart/restart` to the
 * `settingRestart` Cordis service (`SettingRestartService` in `index.js`).
 */
import { z } from "zod";

/** Strict result codec: one success branch plus an explicit failure branch. */
const restartResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    value: z.object({ scheduled: z.literal(true) })
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string()
    })
  })
]);

export const TYPERT = {
  package: "dsh-setting-restart",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "dsh-setting-restart#settingRestart/restart",
      service: "settingRestart",
      namespace: "settingRestart",
      method: "restart",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "dsh-setting-restart/types#RestartResult",
        create: () => restartResultSchema,
        jsonSchema: z.toJSONSchema(restartResultSchema)
      }
    }
  ],
  model: {
    services: [
      {
        key: "settingRestart",
        exportName: "SettingRestartService",
        description:
          "Restart the DSH host process: a detached helper re-spawns the exact same command after this process exits.",
        summary: "One-click DSH service restart.",
        tags: [],
        jsDoc:
          "/**\n * Restart the DSH host process: a detached helper re-spawns the exact\n * same command after this process exits.\n */",
        members: [
          {
            kind: "method",
            name: "restart",
            signature: "@Remote('restart') restart(): Promise<RestartResult>",
            summary: "Schedule a host process restart and exit.",
            jsDoc:
              "/**\n * Schedule a host process restart and exit.\n * @returns `{ ok: true, value: { scheduled: true } }` once the relaunch\n * helper is running, or an explicit failure.\n */"
          }
        ],
        types: [
          {
            name: "RestartResult",
            declaration:
              "export type RestartResult = { readonly ok: true; readonly value: { readonly scheduled: true } } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };"
          }
        ]
      }
    ],
    events: [],
    objects: []
  }
};
