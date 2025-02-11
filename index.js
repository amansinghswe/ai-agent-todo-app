import {db} from './db/index.js';
import { todosTable } from './db/schema.js';
import {ilike, eq} from 'drizzle-orm'
import OpenAI from "openai";
import readLineSync from "readline-sync";

const client = new OpenAI();


async function getAllTodos() {
    const todos = await db.select().from(todosTable);
    return todos;
}

async function createTodo(todo) {
    const [result] = await db.insert(todosTable).values({
        todo,
    }).returning({
        id: todosTable.id,
    });
    return result.id
}

async function searchTodo(search) {
    const todos = await db
        .select()
        .from(todosTable)
        .where(ilike(todosTable.todo, `%${search}%`))
    return todos;
}

async function deleteTodoById(id) {
    await db.delete(todosTable).where(eq(todosTable.id, id));
}

const tools = {
    getAllTodos: getAllTodos,
    createTodo: createTodo,
    deleteTodoById: deleteTodoById,
    searchTodo: searchTodo
}

const SYSTEM_PROMPT = `

You are an AI To-Do List Assistant with START, PLAN, ACTION, Observation, and OUTPUT Capabilities.
Wait for the user prompt and first plan using available tools
After Planning, take the action with appropriate tools and wait for Observation based on action.
Once you get the Observation, return the AI response based on START Prompt and obserations

You can manage tasks by adding, viewing, updating and deleting them.
You must strictly follow the JSON output format.


TODO DB Schema :
id : integer and primaryKey
todo : string
created_at : Date Time
updated_at : Date Time

Available tools :
- getAllTodos(): Returns all the todos from the database
- createTodo(todo: string) : Creates a new todo in the db and takes todo as a string and returns the id of the created todo
- deleteTodoById(id: string) : Deletes a todo by id given in the db
- searchTodo(query: string) : Searches for a todo matching the query string using ilike

Example :
START :
{"type" : "user", "user" : "Add a task for shopping groceries"}
{"type" : "plan", "plan" : "I will try to get more context on what user needs to shop"}
{"type" : "output", "output" : "Can you tell me what all items to you want to shop for"}
{"type" : "user", "output" : "I want to shop for milk, kurkure, lays and chocolate."}
{"type" : "plan", "plan" : "I will use createTodo to create a todo in db"}
{"type" : "action", "function" : "createTodo", "input": "Shopping for milk, kurkure, lays and chocolate."}
{"type" : "obseration", "obseration" : "2"}
{"type" : "output", "output" : "Your todo has been added successfully"}
`;

const messages = [{role: "system", content: SYSTEM_PROMPT}]

while (true) {
    const query = readLineSync.question(">> ")
    const userMessage = {
        type : "user",
        user : query
    }
    messages.push({role : "user", content: JSON.stringify(userMessage)})

    while (true) {
        const chat = await client.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: {type : "json_object"}
        })
        const result = chat.choices[0].message.content;
        messages.push({role : "assistant", content: result})

        const action = JSON.parse(result);
        if (action.type === "output") {
            console.log(`🤖: ${action.output}`)
            break;
        } else if (action.type === "action") {
            const fn = tools[action.function];
            if (!fn) throw new Error("Invalid Tool Call")
            const observation = await fn(action.input)
            const observationMessage = {
                type : "obseration",
                obseration: observation
            }
            messages.push({
                role: "developer",
                content: JSON.stringify(observationMessage)
            })
        }
    }
}
