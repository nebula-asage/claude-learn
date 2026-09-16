//! ユーザー管理コマンドラインアプリケーション
//!
//! このプログラムは、ユーザー情報の管理を行うコマンドラインインターフェースを提供します。
//! 以下の操作が可能です：
//!
//! - ユーザーの作成
//! - ユーザー情報の更新
//! - ユーザー一覧の表示
//! - 特定ユーザーの情報表示
//! - ユーザーの削除

use rust_learn::commands::user_command::UserCommand;
use std::env;

/// コマンドの使用方法を標準出力に表示します。
fn print_usage() {
    println!("Usage:");
    println!("  create <email> <username> <phone> <age>");
    println!("  update <email> <username> <phone> <age>");
    println!("  list");
    println!("  get <email>");
    println!("  delete <email>");
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        return;
    }

    let command = UserCommand::new();
    let result = match args[1].as_str() {
        "create" => command.create(&args[2..]),
        "update" => command.update(&args[2..]),
        "list" => command.list(),
        "get" => command.get(&args[2..]),
        "delete" => command.delete(&args[2..]),
        _ => {
            print_usage();
            Ok(())
        }
    };

    if let Err(e) = result {
        eprintln!("Error: {}", e);
    }
}
