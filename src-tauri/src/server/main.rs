fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    // Intercept dialog requests to run them on the OS main thread (required by macOS)
    if args.len() >= 2 && args[1] == "--dialog" {
        // Read options JSON from stdin
        use std::io::Read;
        let mut input = String::new();
        if std::io::stdin().read_to_string(&mut input).is_ok() {
            if let Ok(options) = serde_json::from_str::<serde_json::Value>(&input) {
                app_lib::server::routes::system::run_sync_dialog(&args[2], options);
            }
        }
        return;
    }

    // Otherwise, start the standard Axum server in a Tokio runtime
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap()
        .block_on(async {
            app_lib::server::start_server().await;
        })
}
