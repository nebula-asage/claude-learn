package __BASE_PACKAGE__;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/** アプリケーション全体の起動テスト。 */
@SpringBootTest
class __APP_CLASS__Tests {

  @Test
  @DisplayName("Spring のコンテキストが起動できる")
  void contextLoads() {
    // Bean の定義ミスや設定ファイルの誤りはここで落ちる。
    // 起動できること自体が検証内容なので、本文は空でよい。
  }
}
