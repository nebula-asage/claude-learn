import { afterEach, describe, expect, it, vi } from "vitest";
import { installFetchMock, jsonResponse, pagedResponse } from "../helpers/fetchMock.js";
import { groupFixture, groupMemberFixture } from "../helpers/fixtures.js";
import { connect, errText, okJson, type PagedPayload } from "../helpers/mcp.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gitlab_list_groups", () => {
  it("search がクエリに乗る", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_groups", { search: "grp" });
    expect(mock.lastQuery()).toMatchObject({ search: "grp" });
    await harness.close();
  });

  it("groupSummary の8キーに整形する", async () => {
    installFetchMock(() => pagedResponse([groupFixture()]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_groups", {}),
    );
    expect(payload.items[0]).toEqual({
      id: 100,
      name: "grp",
      path: "grp",
      full_path: "top/grp",
      description: "説明文",
      visibility: "private",
      web_url: "https://gitlab.example.com/groups/top/grp",
      parent_id: null,
    });
    await harness.close();
  });
});

describe("gitlab_get_group", () => {
  it("/groups/{id} を叩く（group引数はURLエンコードされる）", async () => {
    const mock = installFetchMock(() => jsonResponse(groupFixture()));
    const harness = await connect();
    await harness.call("gitlab_get_group", { group: "top/grp" });
    expect(mock.last().url.pathname).toBe("/api/v4/groups/top%2Fgrp");
    await harness.close();
  });
});

describe("gitlab_list_group_members", () => {
  it("query がクエリに乗り、/groups/{id}/members を叩く", async () => {
    const mock = installFetchMock(() => pagedResponse([]));
    const harness = await connect();
    await harness.call("gitlab_list_group_members", { group: "top/grp", query: "ali" });
    expect(mock.last().url.pathname).toBe("/api/v4/groups/top%2Fgrp/members");
    expect(mock.lastQuery()).toMatchObject({ query: "ali" });
    await harness.close();
  });

  it("memberSummary の8キーに整形し access_level_name を付与する", async () => {
    installFetchMock(() => pagedResponse([groupMemberFixture({ access_level: 40 })]));
    const harness = await connect();
    const payload = okJson<PagedPayload<Record<string, unknown>>>(
      await harness.call("gitlab_list_group_members", { group: "top/grp" }),
    );
    expect(payload.items[0]).toEqual({
      id: 7,
      username: "alice",
      name: "Alice",
      state: "active",
      access_level: 40,
      access_level_name: "Maintainer",
      expires_at: null,
      web_url: "https://gitlab.example.com/alice",
    });
    await harness.close();
  });
});

describe("gitlab_add_group_member", () => {
  it("POST /groups/{id}/members に user_id/access_level/expires_at を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(groupMemberFixture()));
    const harness = await connect();
    await harness.call("gitlab_add_group_member", {
      group: "top/grp",
      user_id: 7,
      access_level: 30,
      expires_at: "2027-01-01",
    });
    expect(mock.last().method).toBe("POST");
    expect(mock.last().url.pathname).toBe("/api/v4/groups/top%2Fgrp/members");
    expect(mock.last().body).toEqual({
      user_id: 7,
      access_level: 30,
      expires_at: "2027-01-01",
    });
    await harness.close();
  });

  it("未指定フィールドは JSON.stringify によりボディから消える", async () => {
    const mock = installFetchMock(() => jsonResponse(groupMemberFixture()));
    const harness = await connect();
    await harness.call("gitlab_add_group_member", {
      group: "top/grp",
      user_id: 7,
      access_level: 30,
    });
    expect(mock.last().body).toEqual({ user_id: 7, access_level: 30 });
    await harness.close();
  });
});

describe("gitlab_update_group_member", () => {
  it("PUT /groups/{id}/members/{user_id} で access_level を送る", async () => {
    const mock = installFetchMock(() => jsonResponse(groupMemberFixture({ access_level: 20 })));
    const harness = await connect();
    await harness.call("gitlab_update_group_member", {
      group: "top/grp",
      user_id: 7,
      access_level: 20,
    });
    expect(mock.last().method).toBe("PUT");
    expect(mock.last().url.pathname).toBe("/api/v4/groups/top%2Fgrp/members/7");
    expect(mock.last().body).toEqual({ access_level: 20 });
    await harness.close();
  });
});

describe("gitlab_read_only", () => {
  it("readOnly=true では書込2ツールが isError（ツール未登録）になる", async () => {
    const harness = await connect({ gitlabReadOnly: true });
    for (const name of ["gitlab_add_group_member", "gitlab_update_group_member"]) {
      const result = await harness.call(name, { group: "top/grp", user_id: 7, access_level: 30 });
      expect(errText(result), name).toBeTruthy();
    }
    await harness.close();
  });

  it("readOnly=true でも読取3ツールは動く", async () => {
    installFetchMock((call) =>
      call.url.pathname === "/api/v4/groups/top%2Fgrp"
        ? jsonResponse(groupFixture())
        : pagedResponse([]),
    );
    const harness = await connect({ gitlabReadOnly: true });
    for (const name of ["gitlab_list_groups", "gitlab_get_group", "gitlab_list_group_members"]) {
      const result = await harness.call(name, { group: "top/grp" });
      expect(result.isError, name).not.toBe(true);
    }
    await harness.close();
  });
});

describe("gitlab_add_group_member - 入力バリデーション", () => {
  it("access_level: 25（未定義の値）は isError になる", async () => {
    const harness = await connect();
    const result = await harness.call("gitlab_add_group_member", {
      group: "top/grp",
      user_id: 7,
      access_level: 25,
    });
    expect(result.isError).toBe(true);
    await harness.close();
  });

  it("user_id: 0 は isError になる", async () => {
    const harness = await connect();
    const result = await harness.call("gitlab_add_group_member", {
      group: "top/grp",
      user_id: 0,
      access_level: 30,
    });
    expect(result.isError).toBe(true);
    await harness.close();
  });
});
