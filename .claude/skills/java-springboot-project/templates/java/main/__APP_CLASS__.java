package __BASE_PACKAGE__;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * アプリケーションの起動クラス。
 *
 * <p>このクラスが属するパッケージ配下がコンポーネントスキャンの対象になるため、 新しく作るクラスは必ずこのパッケージより下に置く。
 */
@SpringBootApplication
public class __APP_CLASS__ {

  /**
   * アプリケーションを起動する。
   *
   * @param args コマンドライン引数
   */
  public static void main(String[] args) {
    SpringApplication.run(__APP_CLASS__.class, args);
  }
}
