import { afterEach, describe, expect, it } from "vitest";
import { render } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("render", () => {
  it("要素を生成できないHTMLの場合はエラーを投げる", () => {
    expect(() => render("just text, no element")).toThrow();
  });
});
