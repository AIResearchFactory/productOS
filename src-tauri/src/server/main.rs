#[tokio::main]
async fn main() {
    app_lib::server::start_server().await;
}
