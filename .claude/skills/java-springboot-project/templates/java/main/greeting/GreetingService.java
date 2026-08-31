package __BASE_PACKAGE__.greeting;

import org.springframework.stereotype.Service;

/**
 * 挨拶メッセージを組み立てるドメインロジック。
 *
 * <p>HTTP には一切依存しないので、Spring のコンテキストを起動しない素の JUnit テストで検証できる。
 */
@Service
public class GreetingService {

  /** 名前が指定されなかった場合に使う既定の宛先。 */
  private static final String DEFAULT_NAME = "world";

  /** 宛先の名前として許容する最大文字数。 */
  private static final int MAX_NAME_LENGTH = 50;

  /**
   * 挨拶メッセージを組み立てる。
   *
   * @param name 宛先の名前。{@code null} または空白のみの場合は {@code "world"} を使う
   * @return {@code "Hello, <名前>!"} 形式のメッセージ
   * @throws IllegalArgumentException 名前が {@value #MAX_NAME_LENGTH} 文字を超える場合
   */
  public String greet(String name) {
    String target = (name == null || name.isBlank()) ? DEFAULT_NAME : name.strip();
    if (target.length() > MAX_NAME_LENGTH) {
      throw new IllegalArgumentException(
          "name は %d 文字以内で指定してください: %d 文字".formatted(MAX_NAME_LENGTH, target.length()));
    }
    return "Hello, %s!".formatted(target);
  }
}
