package __BASE_PACKAGE__.greeting;

/**
 * 挨拶 API のレスポンスボディ。
 *
 * <p>レスポンスの形を record として独立させておくと、Service が返す値（ここでは単なる String）を そのまま JSON の形に引きずられずに済む。
 *
 * @param message クライアントに返す挨拶メッセージ
 */
public record GreetingResponse(String message) {}
