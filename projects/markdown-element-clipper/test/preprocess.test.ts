import { afterEach, describe, expect, it } from "vitest";
import { preprocessElement } from "../src/convert/preprocess";
import { render } from "./helpers";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("preprocessElement", () => {
  it("除去対象タグ(script/style/button等)をクローンから削除する", () => {
    const el = render(`
      <div>
        <p>kept</p>
        <script>1</script>
        <style>.a{}</style>
        <button>click</button>
        <input type="text">
      </div>
    `);
    const wrapper = preprocessElement(el);
    expect(wrapper.querySelector("script")).toBeNull();
    expect(wrapper.querySelector("style")).toBeNull();
    expect(wrapper.querySelector("button")).toBeNull();
    expect(wrapper.querySelector("input")).toBeNull();
    expect(wrapper.querySelector("p")?.textContent).toBe("kept");
  });

  it("display:noneとhidden属性の要素をクローンから削除する", () => {
    const el = render(`
      <div>
        <p class="visible">visible</p>
        <p class="hidden-style" style="display:none">a</p>
        <p class="hidden-attr" hidden>b</p>
        <p class="hidden-aria" aria-hidden="true">c</p>
      </div>
    `);
    const wrapper = preprocessElement(el);
    expect(wrapper.querySelector(".visible")).not.toBeNull();
    expect(wrapper.querySelector(".hidden-style")).toBeNull();
    expect(wrapper.querySelector(".hidden-attr")).toBeNull();
    expect(wrapper.querySelector(".hidden-aria")).toBeNull();
  });

  it("巨大なdata URIの画像を削除する", () => {
    const hugeDataUri = "data:image/png;base64," + "A".repeat(600);
    const el = render(`<div><img src="${hugeDataUri}" alt="huge"></div>`);
    const wrapper = preprocessElement(el);
    expect(wrapper.querySelector("img")).toBeNull();
  });

  it("小さいdata URIの画像は残す", () => {
    const smallDataUri = "data:image/png;base64,AAAA";
    const el = render(`<div><img src="${smallDataUri}" alt="small"></div>`);
    const wrapper = preprocessElement(el);
    expect(wrapper.querySelector("img")).not.toBeNull();
  });

  it("ルート要素自身がimgの場合もsrcを絶対化する", () => {
    const el = render(`<img src="./pic.png" alt="pic">`);
    expect(el.tagName).toBe("IMG");
    const wrapper = preprocessElement(el);
    const img = wrapper.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/dir/pic.png");
  });

  it("liを単体選択するとul/olで正しく包まれる", () => {
    const el = render(`<ul><li>only</li></ul>`);
    const li = el.querySelector("li");
    const wrapper = preprocessElement(li as Element);
    expect(wrapper.querySelector("ul > li")?.textContent).toBe("only");
  });

  it("tdを単体選択するとtable/tbody/trで包まれる", () => {
    const el = render(`<table><tbody><tr><td>cell</td></tr></tbody></table>`);
    const td = el.querySelector("td");
    const wrapper = preprocessElement(td as Element);
    expect(wrapper.querySelector("table tbody tr td")?.textContent).toBe("cell");
  });
});
