#!/usr/bin/env node
import { Octokit } from '@octokit/rest';

/**
 * Interface for spotlight options
 */
interface SpotlightOptions {
    delay?: number;
    limit?: number;
    minViews?: number;
    includeForks?: boolean;
    includeArchived?: boolean;
}
/**
 * Main spotlight functionality
 */
declare function spotlightRepos(octokit: Octokit, username: string, { delay, limit, minViews, includeForks, includeArchived }?: SpotlightOptions): Promise<{
    name: string;
    views: number;
}[]>;
/**
 * Checks if the script is being executed directly
 * @returns true if the script is being executed directly
 */
declare function isDirectExecution(): boolean;
/**
 * Gets the GitHub token from environment variables or input
 * @returns GitHub token
 * @throws {Error} When token is not found
 */
declare function getToken(): string;
/**
 * Gets the username from context or environment
 * @returns GitHub username
 */
declare function getUsername(): string;
/**
 * Gets all options from environment variables or command line arguments
 * @returns Object containing all options
 */
declare function getOptions(): {
    delay: number;
    limit: number;
    minViews: number;
    includeForks: boolean;
    includeArchived: boolean;
};
/**
 * Gets a command line argument value
 * @param flag - The flag to look for
 * @returns The value of the flag or undefined
 */
declare function getArg(flag: string): string | undefined;
/**
 * Gets a value from either GitHub Action input or command line argument
 * @param name - Name of the parameter
 * @param fallback - Default value if not found
 * @returns The parsed number value
 * @throws {Error} When the value cannot be parsed as a number
 */
declare function getInputOrArg(name: string, fallback: number): number;
/**
 * Gets a boolean value from either GitHub Action input or command line flag
 * @param name - Name of the parameter
 * @param flag - Command line flag
 * @returns The boolean value
 */
declare function getBoolInputOrFlag(name: string, flag: string): boolean;
/**
 * Handles errors and exits the process
 * @param error - The error to handle
 */
declare function handleError(error: unknown): never;
/**
 * Main entry point for the CLI and GitHub Action
 * @throws {Error} When required parameters are missing or invalid
 */
declare function main(): Promise<void>;

export { getArg, getBoolInputOrFlag, getInputOrArg, getOptions, getToken, getUsername, handleError, isDirectExecution, main, spotlightRepos };
