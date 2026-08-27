from main import greet


def test_greet_returns_greeting_for_given_name() -> None:
    assert greet("World") == "Hello, World!"
