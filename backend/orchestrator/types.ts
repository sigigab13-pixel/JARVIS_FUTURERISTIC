export type OrchestratorPhase =
    | 'understand'
    | 'plan'
    | 'route'
    | 'execute'
    | 'verify'
    | 'remember'
    | 'respond';

export interface JarvisRequest {
    message: string;
    conversationId?: string;
    userId?: string;
    context?: JarvisContext;
    preferences?: UserPreferences;
    attachments?: AttachmentReference[];
    options?: JarvisRequestOptions;
}

export interface JarvisContext {
    conversationId?: string;
    user?: {
        id?: string;
        displayName?: string;
    };
    locale?: string;
    timezone?: string;
    recentMessages?: ConversationMessage[];
    memories?: MemoryReference[];
    permissions?: PermissionSet;
    activeTool?: string;
    metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
    role: 'system' | 'user' | 'assistant' | 'model';
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
}

export interface UserPreferences {
    name?: string;
    language?: string;
    responseStyle?: string;
    voice?: {
        enabled?: boolean;
        voiceId?: string;
        speakingRate?: number;
        pitch?: number;
    };
    metadata?: Record<string, unknown>;
}

export interface JarvisRequestOptions {
    dryRun?: boolean;
    requiresApproval?: boolean;
    metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
    intent: string;
    summary: string;
    steps: ExecutionStep[];
    requiresApproval?: boolean;
}

export interface ExecutionStep {
    id: string;
    tool: string;
    purpose: string;
    input: Record<string, unknown>;
    dependsOn?: string[];
    requiresApproval?: boolean;
}

export interface JarvisTool {
    name: string;
    description: string;
    version: string;
    capabilities: string[];
    inputSchema: unknown;
    outputSchema: unknown;
    requiresAuth: boolean;
    requiresApproval: boolean;
    execute(
        input: Record<string, unknown>,
        context: JarvisContext,
    ): Promise<ToolResult>;
}

export interface ToolRegistry {
    register(tool: JarvisTool): void;
    get(name: string): JarvisTool | undefined;
    list(): JarvisTool[];
    has(name: string): boolean;
}

export interface ToolResult {
    success: boolean;
    tool: string;
    executionId: string;
    data?: unknown;
    error?: ToolError;
    metadata?: Record<string, unknown>;
    startedAt: string;
    completedAt: string;
}

export interface ToolError {
    code: string;
    message: string;
    retryable: boolean;
    details?: unknown;
}

export interface VerificationResult {
    verified: boolean;
    status: 'confirmed' | 'failed' | 'partial' | 'not_verified';
    evidence?: unknown;
    message?: string;
}

export interface MemoryService {
    recall(
        query: string,
        context: JarvisContext,
    ): Promise<MemoryReference[]>;

    remember(
        memory: MemoryInput,
        context: JarvisContext,
    ): Promise<void>;
}

export interface MemoryReference {
    id: string;
    type: 'preference' | 'fact' | 'conversation' | 'task' | 'project';
    content: string;
    relevance?: number;
    createdAt?: string;
}

export interface MemoryInput {
    type: MemoryReference['type'];
    content: string;
    metadata?: Record<string, unknown>;
}

export interface PermissionSet {
    tools?: Record<string, boolean>;
    scopes?: string[];
    canExecute?: boolean;
    canPublish?: boolean;
}

export interface AttachmentReference {
    type: 'image' | 'audio' | 'video' | 'file';
    name?: string;
    mimeType?: string;
    url?: string;
    data?: string;
    metadata?: Record<string, unknown>;
}

export interface JarvisResponse {
    success: boolean;
    requestId: string;
    conversationId?: string;
    response?: {
        text?: string;
        attachments?: AttachmentReference[];
        metadata?: Record<string, unknown>;
    };
    execution?: {
        plan?: ExecutionPlan;
        results?: ToolResult[];
        verification?: VerificationResult[];
    };
    error?: ToolError;
}
