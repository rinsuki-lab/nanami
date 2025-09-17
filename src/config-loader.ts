import { readFile } from "node:fs/promises"
import z from "zod"
import { load } from "js-yaml"
import { TONClient } from "./ton-client.js"

const zConfig = z.object({
    backends: z.record(z.string(), z.object({
        url: z.url(),
    })),
})

async function loadConfig() {
    let configString: string
    if (process.env.NANAMI_CONFIG != null) {
        configString = process.env.NANAMI_CONFIG
    } else if (process.env.NANAMI_CONFIG_FILE != null) {
        configString = await readFile(process.env.NANAMI_CONFIG_FILE, 'utf-8')
    } else {
        throw new Error("No configuration provided. NANAMI_CONFIG or NANAMI_CONFIG_FILE must be set.")
    }

    const parsed = load(configString)
    const config = zConfig.parse(parsed)

    return {
        backends: Object.fromEntries(
            Object.entries(config.backends).map(([name, backend]) => [name, new TONClient(name, backend.url)])
        ),
        preferredBackend: Object.keys(config.backends)[0] ?? "", // TODO: bucket/key/accesskeyごとにアクセスポリシー側で選択できるようにする
    }
}

export const config = await loadConfig()