import re
import sys

def modifyFile():
    path = "/Users/aviatam/ai-researcher/src/api/runtime.ts"
    with open(path, "r") as f:
        content = f.read()

    # Update imports
    content = content.replace("import { checkServerHealth, serverFetch, systemApi, secretsApi, settingsApi, chatApi, authApi } from './server';", "import { checkServerHealth, serverFetch, systemApi, secretsApi, settingsApi, chatApi, authApi, projectsApi, projectsApiExtended, filesApi, artifactsApi, workflowsApi, skillsApi, mcpApi } from './server';")

    replacements = {
        "  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {\n": 
        "  async getProjectSettings(projectId: string): Promise<ProjectSettings | null> {\n    if (await checkServerHealth()) return serverFetch<ProjectSettings | null>(`/api/settings/project?project_id=${projectId}`);\n",
        
        "  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {\n":
        "  async saveProjectSettings(projectId: string, settings: ProjectSettings): Promise<void> {\n    if (await checkServerHealth()) return serverFetch<void>(`/api/settings/project?project_id=${projectId}`, { method: 'POST', body: JSON.stringify(settings) });\n",

        "  async getAllProjects(): Promise<Project[]> {\n":
        "  async getAllProjects(): Promise<Project[]> {\n    if (await checkServerHealth()) return projectsApi.getAllProjects();\n",

        "  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {\n":
        "  async createProject(name: string, goal: string, skills: string[]): Promise<Project> {\n    if (await checkServerHealth()) return projectsApiExtended.createProject(name, goal, skills);\n",

        "  async renameProject(projectId: string, newName: string): Promise<void> {\n":
        "  async renameProject(projectId: string, newName: string): Promise<void> {\n    if (await checkServerHealth()) return projectsApiExtended.renameProject(projectId, newName);\n",

        "  async deleteProject(projectId: string): Promise<void> {\n":
        "  async deleteProject(projectId: string): Promise<void> {\n    if (await checkServerHealth()) return projectsApiExtended.deleteProject(projectId);\n",

        "  async getProject(projectId: string): Promise<Project | null> {\n":
        "  async getProject(projectId: string): Promise<Project | null> {\n    if (await checkServerHealth()) return projectsApiExtended.getProject(projectId);\n",

        "  async getAllSkills(): Promise<Skill[]> {\n":
        "  async getAllSkills(): Promise<Skill[]> {\n    if (await checkServerHealth()) return skillsApi.getAllSkills();\n",

        "  async getSkill(skillId: string): Promise<Skill> {\n":
        "  async getSkill(skillId: string): Promise<Skill> {\n    if (await checkServerHealth()) return skillsApi.getSkill(skillId);\n",

        "  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {\n":
        "  async createSkill(name: string, description: string, template: string, category: string): Promise<Skill> {\n    if (await checkServerHealth()) return skillsApi.createSkill(name, description, template, category ? [category] : []);\n",

        "  async updateSkill(skill: Skill): Promise<void> {\n":
        "  async updateSkill(skill: Skill): Promise<void> {\n    if (await checkServerHealth()) return skillsApi.updateSkill(skill);\n",

        "  async deleteSkill(skillId: string): Promise<void> {\n":
        "  async deleteSkill(skillId: string): Promise<void> {\n    if (await checkServerHealth()) return skillsApi.deleteSkill(skillId);\n",

        "  async importSkill(_npxCommand: string): Promise<Skill> {\n":
        "  async importSkill(_npxCommand: string): Promise<Skill> {\n    if (await checkServerHealth()) return skillsApi.importSkill(_npxCommand);\n",

        "  async getProjectFiles(projectId: string): Promise<string[]> {\n":
        "  async getProjectFiles(projectId: string): Promise<string[]> {\n    if (await checkServerHealth()) return filesApi.getProjectFiles(projectId);\n",

        "  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {\n":
        "  async readMarkdownFile(projectId: string, fileName: string): Promise<string> {\n    if (await checkServerHealth()) return filesApi.readFile(projectId, fileName);\n",

        "  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {\n":
        "  async writeMarkdownFile(projectId: string, fileName: string, content: string): Promise<void> {\n    if (await checkServerHealth()) return filesApi.writeFile(projectId, fileName, content);\n",

        "  async renameFile(projectId: string, oldName: string, newName: string): Promise<void> {\n":
        "  async renameFile(projectId: string, oldName: string, newName: string): Promise<void> {\n    if (await checkServerHealth()) return filesApi.renameFile(projectId, oldName, newName);\n",

        "  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {\n":
        "  async deleteMarkdownFile(projectId: string, fileName: string): Promise<void> {\n    if (await checkServerHealth()) return filesApi.deleteFile(projectId, fileName);\n",

        "  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {\n":
        "  async getProjectWorkflows(projectId: string): Promise<Workflow[]> {\n    if (await checkServerHealth()) return workflowsApi.getProjectWorkflows(projectId);\n",

        "  async saveWorkflow(workflow: Workflow): Promise<void> {\n":
        "  async saveWorkflow(workflow: Workflow): Promise<void> {\n    if (await checkServerHealth()) return workflowsApi.saveWorkflow(workflow);\n",

        "  async deleteWorkflow(projectId: string, workflowId: string): Promise<void> {\n":
        "  async deleteWorkflow(projectId: string, workflowId: string): Promise<void> {\n    if (await checkServerHealth()) return workflowsApi.deleteWorkflow(projectId, workflowId);\n",

        "  async setWorkflowSchedule(projectId: string, workflowId: string, schedule: WorkflowSchedule): Promise<Workflow> {\n":
        "  async setWorkflowSchedule(projectId: string, workflowId: string, schedule: WorkflowSchedule): Promise<Workflow> {\n    if (await checkServerHealth()) return workflowsApi.setWorkflowSchedule(projectId, workflowId, schedule);\n",

        "  async clearWorkflowSchedule(projectId: string, workflowId: string): Promise<Workflow> {\n":
        "  async clearWorkflowSchedule(projectId: string, workflowId: string): Promise<Workflow> {\n    if (await checkServerHealth()) return workflowsApi.clearWorkflowSchedule(projectId, workflowId);\n",

        "  async getWorkflowHistory(projectId: string, workflowId: string): Promise<WorkflowRunRecord[]> {\n":
        "  async getWorkflowHistory(projectId: string, workflowId: string): Promise<WorkflowRunRecord[]> {\n    if (await checkServerHealth()) return workflowsApi.getWorkflowHistory(projectId, workflowId);\n",

        "  async executeWorkflow(_projectId: string, _workflowId: string, _parameters?: Record<string, string>): Promise<string> {\n":
        "  async executeWorkflow(_projectId: string, _workflowId: string, _parameters?: Record<string, string>): Promise<string> {\n    if (await checkServerHealth()) return workflowsApi.executeWorkflow(_projectId, _workflowId, _parameters);\n",

        "  async importDocument(_projectId: string, _sourcePath: string): Promise<string> {\n    throw new Error('Native document import currently requires the Tauri runtime.');":
        "  async importDocument(_projectId: string, _sourcePath: string): Promise<string> {\n    if (await checkServerHealth()) return filesApi.importDocument(_projectId, _sourcePath);\n    throw new Error('Native document import currently requires the Tauri runtime.');",

        "  async importArtifact(_projectId: string, _artifactType: ArtifactType, _sourcePath: string): Promise<Artifact> {\n    throw new Error('Artifact file import currently requires the Tauri runtime.');":
        "  async importArtifact(_projectId: string, _artifactType: ArtifactType, _sourcePath: string): Promise<Artifact> {\n    if (await checkServerHealth()) return artifactsApi.importArtifact(_projectId, _artifactType, _sourcePath);\n    throw new Error('Artifact file import currently requires the Tauri runtime.');",

        "  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {\n":
        "  async searchInFiles(projectId: string, searchText: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {\n    if (await checkServerHealth()) return filesApi.searchInFiles(projectId, searchText, caseSensitive, useRegex);\n",

        "  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {\n":
        "  async replaceInFiles(projectId: string, searchText: string, replaceText: string, caseSensitive: boolean, fileNames: string[]): Promise<number> {\n    if (await checkServerHealth()) return filesApi.replaceInFiles(projectId, searchText, replaceText, caseSensitive);\n",

        "  async listArtifacts(projectId: string): Promise<Artifact[]> {\n":
        "  async listArtifacts(projectId: string): Promise<Artifact[]> {\n    if (await checkServerHealth()) return artifactsApi.listArtifacts(projectId);\n",

        "  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {\n":
        "  async createArtifact(projectId: string, artifactType: ArtifactType, title: string): Promise<Artifact> {\n    if (await checkServerHealth()) return artifactsApi.createArtifact(projectId, artifactType, title);\n",

        "  async saveArtifact(artifact: Artifact): Promise<void> {\n":
        "  async saveArtifact(artifact: Artifact): Promise<void> {\n    if (await checkServerHealth()) return artifactsApi.saveArtifact(artifact);\n",

        "  async deleteArtifact(projectId: string, artifactId: string, _artifactType: ArtifactType): Promise<void> {\n":
        "  async deleteArtifact(projectId: string, artifactId: string, _artifactType: ArtifactType): Promise<void> {\n    if (await checkServerHealth()) return artifactsApi.deleteArtifact(projectId, _artifactType, artifactId);\n",

        "  async getMcpServers(): Promise<any[]> {\n":
        "  async getMcpServers(): Promise<any[]> {\n    if (await checkServerHealth()) return mcpApi.getMcpServers();\n"
    }

    for old, new_s in replacements.items():
        if old not in content:
            print(f"Warning: could not find: {old}")
        content = content.replace(old, new_s)
        
    with open(path, "w") as f:
        f.write(content)

modifyFile()
