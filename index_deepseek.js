import { db } from './db/index.js';
import { todosTable } from './db/schema.js';
import { ilike, eq } from 'drizzle-orm';
// import DeepSeek from "deepseek-ai"; // Import DeepSeek R1 SDK
import readLineSync from "readline-sync";
import axios from "axios";

const API_KEY = process.env.DEEPSEEK_API_KEY
const API_URL = "https://api.deepseek.com/v1/chat/completions"; // Update if needed

async function getAllTodos() {
    return await db.select().from(todosTable);
}

async function createTodo(todo) {
    const [result] = await db.insert(todosTable).values({ todo }).returning({ id: todosTable.id });
    return result.id;
}

async function searchTodo(search) {
    return await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
}

async function deleteTodoById(id) {
    await db.delete(todosTable).where(eq(todosTable.id, id));
}

const tools = { getAllTodos, createTodo, deleteTodoById, searchTodo };

const SYSTEM_PROMPT = `
You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation, and OUTPUT Capabilities.
Wait for the user prompt and first plan using available tools.
After Planning, take action with appropriate tools and wait for Observation based on action.
Once you get the Observation, return the AI response based on START Prompt and observations.

You can manage tasks by adding, viewing, updating, and deleting them.
You must strictly follow the JSON output format.

TODO DB Schema:
id: integer (Primary Key)
todo: string
created_at: DateTime
updated_at: DateTime

Available tools:
- getAllTodos(): Returns all todos from the database
- createTodo(todo: string): Creates a new todo and returns the ID
- deleteTodoById(id: string): Deletes a todo by ID
- searchTodo(query: string): Searches for a todo matching the query

Example:
START: { "type": "user", "user": "Add a task for shopping groceries" }
PLAN: { "type": "plan", "plan": "I will try to get more context on what user needs to shop" }
OUTPUT: { "type": "output", "output": "Can you tell me what all items you want to shop for?" }
USER: { "type": "user", "user": "I want to shop for milk, chips, and chocolate." }
PLAN: { "type": "plan", "plan": "I will use createTodo to create a todo" }
ACTION: { "type": "action", "function": "createTodo", "input": "Shopping for milk, chips, and chocolate." }
OBSERVATION: { "type": "observation", "observation": "2" }
OUTPUT: { "type": "output", "output": "Your todo has been added successfully" }
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

while (true) {
    const query = readLineSync.question(">> ");
    const userMessage = { type: "user", user: query };
    messages.push({ role: "user", content: JSON.stringify(userMessage) });

    while (true) {
        try {
            const response = await axios.post(API_URL, {
                model: "deepseek-r1",
                messages: messages,
            }, {
                headers: { "Authorization": `Bearer ${API_KEY}` },
            });

            const result = response.data.choices[0].message.content;

            let action;
            try {
                action = JSON.parse(result);
            } catch (error) {
                console.error("Error parsing JSON:", result);
                break;
            }

            messages.push({ role: "assistant", content: JSON.stringify(action) });

            if (action.type === "output") {
                console.log(`🤖: ${action.output}`);
                break;
            }

        } catch (error) {
            console.error("Error with DeepSeek API:", error.response?.data || error.message);
            break;
        }
    }
}
