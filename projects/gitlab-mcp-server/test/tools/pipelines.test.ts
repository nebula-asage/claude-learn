import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installFetchMock,
  jsonResponse,
  pagedResponse,
  textResponse,
} from "../helpers/fetchMock.js";
import { jobFixture, pipelineFixture } from "../helpers/fixtures.js";
import { connect, okJson, type PagedPayload } from "../helpers/mcp.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const STATUS_VALUES = [
  "created",
  "waiting_for_resource",
  "preparing",
  "pending",
  "running",
  "success",
  "failed",
  "canceled",
  "skipped",
  "manual",
  "scheduled",
];

describe("gitlab_list_pipelines", () => {
  it("ref/status がクエリに乗る", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_pipelines", { project: "a/b", ref: "main", status: "success" });
    expect(mock.lastQuery()).toMatchObject({ ref: "main", status: "success" });
    await harness.close();
  });

  it.each(STATUS_VALUES)("status=%s は受理される", async (status) => {
    installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    const result = await harness.call("gitlab_list_pipelines", { project: "a/b", status });
    expect(result.isError).not.toBe(true);
    await harness.close();
  });

  it("未知の status は isError になる", async () => {
    const harness = await connect();
    const result = await harness.call("gitlab_list_pipelines", {
      project: "a/b",
      status: "unknown",
    });
    expect(result.isError).toBe(true);
    await harness.close();
  });

  it("pipelineSummary の7キーに整形し iid/project_id は落ちる", async () => {
    installFetchMock(() => pagedResponse([pipelineFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_pipelines", { project: "a/b" }),
    );
    expect(payload.items[0]).toEqual({
      id: 5001,
      status: "success",
      ref: "main",
      sha: "sha123",
      web_url: "https://gitlab.example.com/grp/sub/proj/-/pipelines/5001",
      created_at: "2026-01-06T00:00:00Z",
      updated_at: "2026-01-06T01:00:00Z",
    });
    await harness.close();
  });
});

describe("gitlab_get_pipeline", () => {
  it("/pipelines/{id} を叩く", async () => {
    const mock = installFetchMock(() => jsonResponse(pipelineFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_pipeline", { project: "a/b", pipeline_id: 5001 });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/pipelines/5001");
    await harness.close();
  });
});

describe("gitlab_list_pipeline_jobs", () => {
  it("/pipelines/{id}/jobs を叩く", async () => {
    const mock = installFetchMock(() => pagedResponse([jobFixture()]));
    const harness = await connect();
    await harness.call("gitlab_list_pipeline_jobs", { project: "a/b", pipeline_id: 5001 });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/pipelines/5001/jobs");
    await harness.close();
  });

  it("jobSummary の9キーに整形し created_at は落ちる。null系は保たれる", async () => {
    installFetchMock(() =>
      pagedResponse([jobFixture({ started_at: null, finished_at: null, duration: null })]),
    );
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_pipeline_jobs", { project: "a/b", pipeline_id: 5001 }),
    );
    expect(Object.keys(payload.items[0] as object).sort()).toEqual(
      [
        "duration",
        "finished_at",
        "id",
        "name",
        "ref",
        "stage",
        "started_at",
        "status",
        "web_url",
      ].sort(),
    );
    expect(payload.items[0]).toMatchObject({ started_at: null, finished_at: null, duration: null });
    await harness.close();
  });
});

describe("gitlab_get_job_log", () => {
  it("/jobs/{id}/trace を getText で叩く", async () => {
    const mock = installFetchMock(() => textResponse("ログ本文"));
    const harness = await connect();
    await harness.call("gitlab_get_job_log", { project: "a/b", job_id: 6001 });
    expect(mock.last().url.pathname).toBe("/api/v4/projects/a%2Fb/jobs/6001/trace");
    await harness.close();
  });

  it("超過時は末尾側が残る（tail 切り詰め、diffのheadと対比）", async () => {
    installFetchMock(() => textResponse("0123456789"));
    const harness = await connect();
    const payload = okJson<{ log: string; notice?: string }>(
      await harness.call("gitlab_get_job_log", { project: "a/b", job_id: 6001, max_bytes: 4 }),
    );
    expect(payload.log).toBe("6789");
    expect(payload.notice).toBeDefined();
    await harness.close();
  });

  it("戻り値は job_id/log/notice の3キーで job_id は引数の値がそのまま返る", async () => {
    installFetchMock(() => textResponse("短いログ"));
    const harness = await connect();
    const payload = okJson<Record<string, unknown>>(
      await harness.call("gitlab_get_job_log", { project: "a/b", job_id: 999 }),
    );
    expect(payload.job_id).toBe(999);
    expect("notice" in payload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual(["job_id", "log"]);
    await harness.close();
  });

  it("max_bytes 既定は100000", async () => {
    installFetchMock(() => textResponse("短いログ"));
    const harness = await connect();
    const payload = okJson<{ notice?: string }>(
      await harness.call("gitlab_get_job_log", { project: "a/b", job_id: 1 }),
    );
    expect(payload.notice).toBeUndefined();
    await harness.close();
  });
});
