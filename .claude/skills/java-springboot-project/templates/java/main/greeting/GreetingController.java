package __BASE_PACKAGE__.greeting;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 挨拶メッセージを返す REST エンドポイント。
 *
 * <p>依存はフィールドインジェクション（{@code @Autowired} をフィールドに付ける形）ではなく コンストラクタで受け取る。こうしておくと {@code new
 * GreetingController(...)} でそのまま生成でき、 テストで Spring のコンテキストを起動する必要が無くなる。
 */
@RestController
@RequestMapping("/api/greetings")
public class GreetingController {

  private final GreetingService greetingService;

  /**
   * コントローラを生成する。
   *
   * @param greetingService 挨拶メッセージの組み立てを担当するサービス
   */
  public GreetingController(GreetingService greetingService) {
    this.greetingService = greetingService;
  }

  /**
   * 挨拶メッセージを返す。
   *
   * @param name 宛先の名前。省略された場合は {@code "world"} 宛の挨拶を返す
   * @return 挨拶メッセージを収めたレスポンスボディ
   */
  @GetMapping
  public GreetingResponse greet(@RequestParam(required = false) String name) {
    return new GreetingResponse(greetingService.greet(name));
  }
}
