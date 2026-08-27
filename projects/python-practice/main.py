"""コマンドラインで挨拶を出力するサンプルスクリプト。"""


def greet(name: str) -> str:
    """指定した名前への挨拶文を返す。

    Args:
        name: 挨拶する相手の名前。

    Returns:
        "Hello, <name>!" 形式の挨拶文。
    """
    return f"Hello, {name}!"


def main() -> None:
    """エントリーポイント。挨拶を標準出力に表示する。"""
    print(greet("Python"))


if __name__ == "__main__":
    main()
