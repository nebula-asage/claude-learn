package __BASE_PACKAGE__.greeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

/**
 * {@link GreetingController} のテスト。
 *
 * <p>{@code @WebMvcTest} は Web 層（Controller・例外ハンドラ・JSON 変換）だけを起動するスライステスト。 {@code @SpringBootTest}
 * と違い DB や外部接続の Bean を作らないので速く、失敗したときに原因が Web 層に絞られる。 Service は {@code @MockitoBean}
 * で差し替え、ここでは「HTTP の入出力が正しいか」だけを見る。
 */
@WebMvcTest(GreetingController.class)
class GreetingControllerTest {

  @Autowired private MockMvcTester mvc;

  @MockitoBean private GreetingService greetingService;

  @Test
  @DisplayName("GET /api/greetings?name=Java は 200 と挨拶メッセージを返す")
  void returnsGreeting() {
    given(greetingService.greet("Java")).willReturn("Hello, Java!");

    assertThat(mvc.get().uri("/api/greetings").param("name", "Java"))
        .hasStatusOk()
        .bodyJson()
        .extractingPath("$.message")
        .isEqualTo("Hello, Java!");
  }

  @Test
  @DisplayName("name を省略しても 200 を返す")
  void returnsGreetingWithoutName() {
    given(greetingService.greet(null)).willReturn("Hello, world!");

    assertThat(mvc.get().uri("/api/greetings"))
        .hasStatusOk()
        .bodyJson()
        .extractingPath("$.message")
        .isEqualTo("Hello, world!");
  }

  @Test
  @DisplayName("Service が IllegalArgumentException を投げたら 400 になる")
  void mapsIllegalArgumentToBadRequest() {
    given(greetingService.greet("too-long")).willThrow(new IllegalArgumentException("名前が長すぎます"));

    assertThat(mvc.get().uri("/api/greetings").param("name", "too-long"))
        .hasStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
        .bodyJson()
        .extractingPath("$.detail")
        .isEqualTo("名前が長すぎます");
  }
}
