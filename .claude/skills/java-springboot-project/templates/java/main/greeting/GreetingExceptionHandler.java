package __BASE_PACKAGE__.greeting;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 挨拶 API で発生した例外を HTTP レスポンスに変換する。
 *
 * <p>これが無いと {@link IllegalArgumentException} は 500 になってしまう。 入力が悪いのはクライアント側なので 400 を返すのが正しい。
 */
@RestControllerAdvice(assignableTypes = GreetingController.class)
public class GreetingExceptionHandler {

  /**
   * 不正な入力を 400 Bad Request に変換する。
   *
   * @param exception 送出された例外
   * @return RFC 9457 形式のエラーレスポンス
   */
  @ExceptionHandler(IllegalArgumentException.class)
  public ProblemDetail handleIllegalArgument(IllegalArgumentException exception) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
    problem.setTitle("Invalid request parameter");
    return problem;
  }
}
