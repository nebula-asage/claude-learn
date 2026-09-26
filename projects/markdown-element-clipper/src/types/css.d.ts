// esbuild の `loader: { '.css': 'text' }` により、CSSファイルは
// 中身の文字列としてimportされる。
declare module "*.css" {
  /** importされたCSSファイルの中身そのもの。 */
  const css: string;
  export default css;
}
