import js from "@eslint/js";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["eslint.config.js", "scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Node CLIスクリプトのため process/console のグローバルを許可する。
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    // JSDoc は src のプロダクションコードにのみ強制する。
    ...jsdoc.configs["flat/recommended-typescript-error"],
    files: ["src/**/*.ts"],
    rules: {
      ...jsdoc.configs["flat/recommended-typescript-error"].rules,

      // export された全シンボル（interface の各フィールド含む）にJSDocを必須にする。
      // publicOnly ではなく ExportNamedDeclaration 起点のセレクタで表現することで、
      // 非exportの内部ヘルパーが対象外になることを保証する。
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            ArrowFunctionExpression: false,
            ClassDeclaration: false,
            ClassExpression: false,
            FunctionDeclaration: false,
            FunctionExpression: false,
            MethodDefinition: false,
          },
          contexts: [
            "ExportNamedDeclaration > FunctionDeclaration",
            "ExportNamedDeclaration > ClassDeclaration",
            "ExportNamedDeclaration > TSInterfaceDeclaration",
            "ExportNamedDeclaration > TSTypeAliasDeclaration",
            // `export const x = ...` は ESLint の JSDoc コメント解決が `export` キーワードを
            // 挟むと素通りしてしまうため、`ExportNamedDeclaration > VariableDeclaration` ではなく
            // 属性セレクタで `ExportNamedDeclaration` 自体をターゲットにする必要がある。
            'ExportNamedDeclaration[declaration.type="VariableDeclaration"]',
            "ExportNamedDeclaration > TSInterfaceDeclaration > TSInterfaceBody > TSPropertySignature",
            'ExportNamedDeclaration > ClassDeclaration > ClassBody > MethodDefinition:not([accessibility="private"])',
          ],
          // TSのパラメータプロパティは自明なため、コンストラクタは必須にしない。
          checkConstructors: false,
          enableFixer: false,
        },
      ],

      // TypeDoc / TSDoc 固有タグを既知タグとして許可する。
      // @packageDocumentation はファイル先頭のモジュールコメントに必須
      // （@module は typed:true のTS環境では冗長タグとして拒否されるため使えない）。
      "jsdoc/check-tag-names": [
        "error",
        {
          typed: true,
          definedTags: ["packageDocumentation", "remarks", "typeParam", "defaultValue"],
        },
      ],

      // 型はTSが持っているため @throws に型括弧を強制しない。
      "jsdoc/require-throws-type": "off",

      // 戻り値が自明な関数に @returns を強要するとノイズになる。
      "jsdoc/require-returns": "off",
    },
  },
  eslintConfigPrettier,
);
