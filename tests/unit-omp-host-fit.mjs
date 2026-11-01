/**
 * Behaviour the OMP host needs from the bridge that pi did not: OMP's own tool
 * defaults and edit schema, and a Claude Code subprocess that cannot silently
 * switch from the subscription to API billing.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const { __test } = await import("../src/index.js");
const { claudeCodeSettings } = await import("../src/config.js");

describe("claudeCodeSettings", () => {
	it("passes a configured output style to Claude Code", () => {
		assert.deepStrictEqual(claudeCodeSettings({ outputStyle: "omp-bridge" }), { autoMemoryEnabled: false, outputStyle: "omp-bridge" });
	});

	it("leaves Claude Code's own style choice alone when none is configured", () => {
		assert.ok(!("outputStyle" in claudeCodeSettings({})));
	});
});

describe("mapToolArgs on OMP", () => {
	it("leaves bash without a timeout so OMP's default applies", () => {
		assert.deepStrictEqual(__test.mapToolArgs("bash", { command: "nix build" }), { command: "nix build" });
	});

	it("keeps an explicit bash timeout", () => {
		assert.deepStrictEqual(__test.mapToolArgs("bash", { command: "make", timeout: 900 }), { command: "make", timeout: 900 });
	});

	it("passes replace-mode edit keys through and maps only the path alias", () => {
		assert.deepStrictEqual(
			__test.mapToolArgs("edit", { file_path: "a.ts", old_string: "x", new_string: "y" }),
			{ path: "a.ts", old_string: "x", new_string: "y" },
		);
	});
});

describe("Claude Code child environment", () => {
	const saved = {};
	afterEach(() => {
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	it("drops variables that would switch Claude Code off the subscription", () => {
		for (const key of [...__test.CC_BILLING_ENV_KEYS, "OMP_BRIDGE_TEST_KEEP"]) {
			saved[key] = process.env[key];
			process.env[key] = "set";
		}
		const env = __test.claudeCodeChildEnv();
		for (const key of __test.CC_BILLING_ENV_KEYS) assert.ok(!(key in env), `${key} leaked`);
		assert.equal(env.OMP_BRIDGE_TEST_KEEP, "set");
		for (const [key, value] of Object.entries(__test.CC_CHILD_ENV)) assert.equal(env[key], value);
	});
});
