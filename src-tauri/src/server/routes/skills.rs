use app_lib::commands::skill_commands;
use app_lib::models::skill::{Skill, SkillCategory};
use axum::{extract::Query, routing::{get, post, put, delete}, Json, Router};
use serde::Deserialize;
use std::collections::HashMap;
use super::utils::internal_error;

pub fn router() -> Router<super::super::AppState> {
    Router::new()
        .route("/", get(get_all_skills))
        .route("/get", get(get_skill))
        .route("/save", put(save_skill))
        .route("/delete", delete(delete_skill))
        .route("/create", post(create_skill))
        .route("/update", put(update_skill))
        .route("/import", post(import_skill))
        .route("/template", post(create_skill_template))
        .route("/by-category", get(get_skills_by_category))
        .route("/render", post(render_skill_prompt))
        .route("/validate", post(validate_skill))
}

async fn get_all_skills() -> Result<Json<Vec<Skill>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::get_all_skills()
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct SkillQuery {
    skill_id: String,
}

async fn get_skill(Query(q): Query<SkillQuery>) -> Result<Json<Skill>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::get_skill(q.skill_id)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn save_skill(Json(skill): Json<Skill>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::save_skill(skill)
        .await
        .map_err(internal_error)
}

async fn delete_skill(Query(q): Query<SkillQuery>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::delete_skill(q.skill_id)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct CreateSkillRequest {
    name: String,
    description: String,
    prompt_template: String,
    capabilities: Vec<String>,
}

async fn create_skill(Json(req): Json<CreateSkillRequest>) -> Result<Json<Skill>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::create_skill(req.name, req.description, req.prompt_template, req.capabilities)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn update_skill(Json(skill): Json<Skill>) -> Result<(), (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::update_skill(skill)
        .await
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct ImportSkillRequest {
    skill_command: String,
}

async fn import_skill(Json(req): Json<ImportSkillRequest>) -> Result<Json<Skill>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::import_skill(req.skill_command)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct CreateTemplateRequest {
    skill_id: String,
    name: String,
    description: String,
    category: SkillCategory,
}

async fn create_skill_template(Json(req): Json<CreateTemplateRequest>) -> Result<Json<Skill>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::create_skill_template(req.skill_id, req.name, req.description, req.category)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct CategoryQuery {
    category: SkillCategory,
}

async fn get_skills_by_category(Query(q): Query<CategoryQuery>) -> Result<Json<Vec<Skill>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::get_skills_by_category(q.category)
        .await
        .map(Json)
        .map_err(internal_error)
}

#[derive(Deserialize)]
struct RenderPromptRequest {
    skill_id: String,
    params: HashMap<String, String>,
}

async fn render_skill_prompt(Json(req): Json<RenderPromptRequest>) -> Result<Json<String>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::render_skill_prompt(req.skill_id, req.params)
        .await
        .map(Json)
        .map_err(internal_error)
}

async fn validate_skill(Json(skill): Json<Skill>) -> Result<Json<Vec<String>>, (axum::http::StatusCode, Json<serde_json::Value>)> {
    skill_commands::validate_skill(skill)
        .await
        .map(Json)
        .map_err(internal_error)
}
