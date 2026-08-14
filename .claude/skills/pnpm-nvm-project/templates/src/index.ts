/**
 * エントリポイント。
 * @packageDocumentation
 */

/**
 * name に挨拶するメッセージを組み立てて返す。
 * @param name 挨拶の相手の名前。
 */
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

console.log(greet("TypeScript"));
