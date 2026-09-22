import type { JarvisTool, ToolRegistry as ToolRegistryContract } from './types';

export class ToolRegistry implements ToolRegistryContract {
    private readonly tools = new Map<string, JarvisTool>();

    register(tool: JarvisTool): void {
        const name = tool.name.trim();
        if (!name) {
            throw new Error('Tool name is required.');
        }

        if (this.tools.has(name)) {
            throw new Error(`Tool already registered: ${name}`);
        }

        this.tools.set(name, tool);
    }

    get(name: string): JarvisTool | undefined {
        return this.tools.get(name);
    }

    list(): JarvisTool[] {
        return Array.from(this.tools.values());
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }
}
