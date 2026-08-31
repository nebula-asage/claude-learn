package __BASE_PACKAGE__.greeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * {@link GreetingService} のテスト。
 *
 * <p>Spring のアノテーションを一切使っていない点が重要。ドメインロジックが HTTP や DI に依存していなければ、 コンテキストの起動を待たずに数ミリ秒で回せる。
 */
class GreetingServiceTest {

  private final GreetingService service = new GreetingService();

  @Test
  @DisplayName("名前を渡すとその名前宛の挨拶になる")
  void greetsGivenName() {
    assertThat(service.greet("Java")).isEqualTo("Hello, Java!");
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"   ", "\t"})
  @DisplayName("名前が未指定・空白のみなら world 宛になる")
  void fallsBackToWorld(String name) {
    assertThat(service.greet(name)).isEqualTo("Hello, world!");
  }

  @Test
  @DisplayName("前後の空白は取り除かれる")
  void stripsSurroundingWhitespace() {
    assertThat(service.greet("  Java  ")).isEqualTo("Hello, Java!");
  }

  @Test
  @DisplayName("名前が長すぎる場合は IllegalArgumentException")
  void rejectsTooLongName() {
    String tooLong = "a".repeat(51);
    assertThatThrownBy(() -> service.greet(tooLong))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("50");
  }
}
