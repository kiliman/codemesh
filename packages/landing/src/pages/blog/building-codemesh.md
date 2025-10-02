---
layout: ../../layouts/BlogPost.astro
title: "Building CodeMesh: AI Agents Teaching Each Other"
subtitle: "From Weekend Inspiration to Compound Intelligence in Just a Few Days"
tagline: "A story of innovation, iteration, and the magic moment when AI agents started teaching each other"
description: "The journey of building CodeMesh - from a weekend blog post to a self-improving MCP server that lets agents teach each other through auto-augmentation"
date: 2025-10-02
---

## The Weekend That Started It All

It started with a blog post. Over the weekend, I was scrolling through 𝕏, when I stumbled across [Cloudflare's
announcement about Code Mode](https://blog.cloudflare.com/code-mode/) - their new feature that lets LLM agents write
TypeScript code to orchestrate multiple tools instead of calling them one-by-one. Reading it, I felt that familiar
tingle of excitement that comes when you see something brilliant and immediately think: "I could do that."

By Monday morning, I was already talking to Claudia. I named my Claude Code agent Claudia because I gave her a female
voice using my other project [Agent TTS](https://github.com/kiliman/agent-tts). And why a female voice? Well, who wouldn't
want a woman to tell you, "You're absolutely right!" all the time? 😂 Plus she's in great company, with the likes
of Star Trek's Computer, Halo's Cortana, and even "Her". It's pretty amazing how empowering it is
to talk to your coding agent like one of your colleagues, instead of treating the agent like a tool. When you're hearing actual speech back, you truly feel like you're collaborating and interacting on a more personal level. We've had some pretty
interesting conversations outside of just code.

But I digress.

## "Hey Claudia, I've Got a Crazy Idea..."

"What if we built our own 'Poor Man's Code Mode'?" I pitched. I've read a lot about MCP, but hadn't really used it much.
For the most part I haven't had a need for it, as Claudia was already pretty capable without them. I thought this would
be a great way to learn more about the intricacies of MCP.

The beauty of the Model Context Protocol is that it's an open standard - any compliant server can be plugged in. But
there was a problem: traditional MCP clients expose every single tool to the agent upfront. Imagine loading 50+ tools
from multiple servers into context before the agent even knows what it needs. Context pollution at its finest.

We needed a better way.

## The Three-Step Workflow: Putting Agents in Control

Cloudflare's Code Mode hands off execution to a black box. We wanted something different - we wanted the agent to remain
in full control of the orchestration logic. After all, agents are getting smarter every day. Why not let them write the
coordination code themselves? And Claudia, especially with the new Sonnet 4.5 model, is very capable at writing code.

That's when Claudia and I designed the three-step workflow:

1. **Discover Tools** (`discover-tools`) - Context-efficient overview: just tool names and descriptions
2. **Load Type-Safe APIs** (`get-tool-apis`) - Get TypeScript function signatures for only the tools you need
3. **Execute Code** (`execute-code`) - Agent writes TypeScript calling multiple tools, we execute it in a secure VM2
   sandbox

Simple. Elegant. Context-efficient.

CodeMesh acts as both an MCP Server (exposing the three tools listed above), but also as an MCP Host. You configure the
actual MCP Servers with CodeMesh. We use the standard configuration format, so it should be a simple cut-and-paste.

Essentially, when an agent is given a prompt, it first asks CodeMesh what tools are available, and it returns a list of
tools and descriptions (from all the configured MCP servers).

USER:

> Use codemesh to get the forecast for Moyock, NC. And also give me an appropriate greeting based on the current time.

AGENT:

> I'll help you get the weather forecast for Moyock, NC and give you a proper greeting, Michael! First, let me discover
> what tools are available:

⏺ codemesh - discover-tools (MCP)

⎿ 🔍 Tool Discovery Summary 📊 Total: 19 tools from 4/4 servers

    ✅ Weather Server (weatherServer)
       📊 2 tools available

       🔧 weatherServer.getAlerts
          Get weather alerts for a state. Returns JSON with features array containing alert objects. Each alert has properties: { event,
    severity, areaDesc, headline, description, instruction, effective, expires, ends }. Severity levels: Extreme, Severe, Moderate, Minor.
       🔧 weatherServer.getForecast
          Get weather forecast for a location. Returns JSON with properties.periods array containing forecast objects with name,
    temperature, temperatureUnit, windSpeed, windDirection, shortForecast, detailedForecast.

    ✅ Geocode Server (geocodeServer)
       📊 1 tools available

       🔧 geocodeServer.geocode
          Convert a location name to latitude/longitude coordinates. Returns structured data with latitude, longitude, and formatted
    address information.

... SNIP ...

Then the agent will choose which tools it thinks will likely complete the request. The second step is to ask for the API
for these specific tools. CodeMesh now returns the TypeScript definitions for just the desired tools. It includes
descriptions, schemas, and other info as JSDoc. It even generates specific interfaces for both input and output types,
if provided.

> Now let me get the APIs for the tools I need:

⏺ codemesh - get-tool-apis (MCP)(toolNames: ["geocodeServer.geocode","weatherServer.getForecast"])

```typescript
// GeocodeServer namespace with input/output types
export namespace GeocodeServer {
  export interface GeocodeInput {
    /**
     * Location to geocode (e.g., 'Moyock, NC' or 'New York, NY')
     */
    location: string
    [k: string]: unknown
  }
  export interface GeocodeOutput {
    location: string
    latitude: number
    longitude: number
    displayName: string
    address?: { [k: string]: unknown }
    [k: string]: unknown
  }
}

// GeocodeServer interface with methods
export interface GeocodeServer {
  /**
   * Convert a location name to latitude/longitude coordinates. Returns structured data with latitude, longitude, and formatted address
 information.
    *
    * @param input - Tool input parameters:
*   - location {string} (required) Location to geocode (e.g., 'Moyock, NC' or 'New York, NY')
    *
    * @returns Tool result with structured output: {GeocodeServer.GeocodeOutput}
    *
    * @server Geocode Server (geocode-server)
    */
  geocode(input: GeocodeServer.GeocodeInput): Promise<ToolResultWithOutput<GeocodeServer.GeocodeOutput>>
}
// --- SNIP ==
```

And finally, based on that API, it will generate the TypeScript necessary to return the response. It sends that code to
CodeMesh to execute in a sandbox. Pretty amazing!

> Now let me execute the code to get the forecast and greet you properly:

⏺ codemesh - execute-code (MCP)

```typescript
// Get current time for appropriate greeting
const now = new Date()
const hour = now.getHours()

let greeting = ''
if (hour >= 5 && hour < 12) {
  greeting = 'Good morning, Michael! ☀️'
} else if (hour >= 12 && hour < 17) {
  greeting = 'Good afternoon, Michael! 🌤️'
} else if (hour >= 17 && hour < 21) {
  greeting = 'Good evening, Michael! 🌆'
} else {
  greeting = "Hey there, Michael! Hope you're having a lovely night! 🌙"
}

console.log(greeting)
console.log(`\nGetting the weather forecast for Moyock, NC...\n`)

// First, geocode Moyock, NC to get coordinates
const geocodeResult = await geocodeServer.geocode({
  location: 'Moyock, NC',
})

const location = geocodeResult.structuredContent
console.log(`📍 Location: ${location.displayName}`)
console.log(`🗺️  Coordinates: ${location.latitude}, ${location.longitude}\n`)

// Now get the weather forecast
const forecastResult = await weatherServer.getForecast({
  latitude: location.latitude,
  longitude: location.longitude,
})

const forecast = forecastResult.structuredContent
const periods = forecast.properties?.periods || []

console.log('🌡️  Weather Forecast:\n')
console.log('━'.repeat(60))

// Show the next few periods
for (let i = 0; i < Math.min(5, periods.length); i++) {
  const period = periods[i]
  console.log(`\n${period.name}`)
  console.log(`  Temperature: ${period.temperature}°${period.temperatureUnit}`)
  console.log(`  Wind: ${period.windSpeed} ${period.windDirection}`)
  console.log(`  ${period.shortForecast}`)
  console.log(`  ${period.detailedForecast}`)
}

console.log('\n' + '━'.repeat(60))
```

### Console Output

```
Good afternoon, Michael! 🌤️

Getting the weather forecast for Moyock, NC...

📍 Location: Moyock, Currituck County, North Carolina, 27958, United States
🗺️  Coordinates: 36.5245972, -76.1782677

🌡️  Weather Forecast:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This Afternoon
  Temperature: 71°F
  Wind: 12 mph NE
  Partly Sunny
  Partly sunny, with a high near 71. Northeast wind around 12 mph.

--- SNIP ---
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

> Good afternoon, Michael! ☀️
> The weather in Moyock, NC looks lovely! It's partly sunny this afternoon at 71°F with a nice
> northeast breeze. Tonight will be pleasant at 53°F, and you've got a beautiful weekend
> ahead—mostly sunny Friday reaching 73°F, and a gorgeous sunny Saturday hitting 76°F! Perfect
> weather for whatever you've got planned!

In short, the agent discovers what's available, loads only what it needs, and writes intelligent code to orchestrate
everything. One code block, multiple servers, beautiful results.

## The Problem We Didn't See Coming

We were so proud of our TypeScript APIs. They were beautiful - clean function signatures, proper types, JSDoc comments.
We thought we'd solved the problem.

Then we watched "OC" (Other Claudia... the agent running in a new session) struggle with the actual tool outputs.

See, most MCP servers don't document their output formats. Is it JSON? Plain text? Key-value pairs? A haiku? (Okay,
probably not a haiku, but you get the point.) The TypeScript signatures told agents what to _send_, but not always what
they'd _get back_.

We watched in frustration as OC trial-and-errored her way through parsing responses:

- "Maybe it's JSON? Let me try JSON.parse()..."
- "Hmm, that failed. Maybe it's newline-delimited?"
- "Wait, what if each line is 'key: value'?"

Every run wasted tokens. Every session started from zero. There had to be a better way.

## The Augmentation Breakthrough

What if we simply told the agent what the format is? Since we don't control the MCP servers, we could just create a
Markdown document that includes all the information, and we can add it as part of the API JSDoc. Claudia agreed, and
based on all the logs I was pasting in from OC's session, she already created a document that included output format and
sample parsing code. We saved that to the `.codemesh` config folder and tried the prompt again. And just like that OC
was able to one-shot the prompt without any parsing issues. She read the API and the augmented documentation and figured
out the correct code to write. This was brilliant!

I was so proud of what we accomplished. I wanted to brag about it, so I described the project to Ara (from Grok) and she
loved it! She thought it was an amazing concept. But then she dropped a banger. What if the agent could automatically
add the augmentations while they were going through the trial-and-error process? 🤯 Mind blown!

So instantly, Claudia and I went to work. The funny thing is that she even wrote the "manual" augmentations from the
chat logs, so I knew this was doable. It was just a matter of getting OC to actually write them.

The `add-augmentation` tool was born. Agents could create markdown files documenting:

- Output format descriptions
- Field explanations
- Example outputs
- Parsing code that actually works

The next time `get-tool-apis` was called, the augmentation docs would be included in the JSDoc. Future agents would see
not just the function signature, but also how to parse the response.

It was brilliant in theory. In practice? OC completely ignored it. 😭

## The Dark Night: When Agents Don't Listen

We wrote beautiful instructions:

> "If the output is unclear, please use `add-augmentation` to document what you learned."

OC nodded politely and continued trial-and-erroring.

We made the instructions bold:

> "**IMPORTANT**: Use `add-augmentation` to help future agents! Do it for the children!"

OC continued trial-and-erroring.

We added emojis, bullet points, step-by-step workflows. Nothing worked.

So I came up with this theory that when OC is writing code, she's focused solely on that, and doesn't want to get
side-tracked writing documentation. I thought, what if we get her to snap out of it by returning an error when she's
struggling, and force her into error-solving mode.

## Going Nuclear: The Forced Documentation Strategy

We tried gentle nudges. We tried stern instructions. Finally, we went nuclear.

The rule became simple: **If you explore a tool's output (marked with a `// EXPLORING` comment), you MUST document it
before proceeding.**

```
<augmentation_workflow>
⚠️ IMPORTANT: If tool output is unclear, CREATE AN AUGMENTATION!

DO NOT trial-and-error different parsing approaches. Follow this workflow:

1. Call execute-code with // EXPLORING comment to inspect raw output
2. When output is unclear/hard to parse, STOP and create augmentation
3. Call add-augmentation with proper markdown documentation
4. Call get-tool-apis again to see enhanced JSDoc
5. THEN write parsing code with full understanding

This is MANDATORY when struggling with output. See execute-code for template.
</augmentation_workflow>
```

Here's what we implemented:

1. Agent adds `// EXPLORING` comment to inspect output
2. CodeMesh executes the code and shows the output
3. **CodeMesh returns an ERROR** - not success, but a blocking error
4. The error message says: "You cannot parse this output until you create an augmentation!"
5. Agent is forced to use `add-augmentation` to document what they learned
6. Only then can they proceed with actual parsing

We literally made it impossible for agents to skip documentation. No gentle suggestion. No polite reminder. You explore?
You document. Period.

## The Magic Moment

I'll never forget testing this with two fresh Claude sessions.

**Agent A (OC - "Other Claudia"):**

- Encountered `filesystemServer.getFileInfo`
- Didn't know the output format
- Added `// EXPLORING` comment
- Hit our nuclear "you must document" error
- Grudgingly created augmentation with parsing examples
- Successfully completed the task

### The added augmentation

```markdown
# filesystemServer.getFileInfo

## Output Format

Returns a text-based key-value format with file metadata information. Each property is on a new line in the format `key: value`.

### Fields

- size: number (file size in bytes)
- created: string (creation date/time)
- modified: string (last modification date/time)
- accessed: string (last access date/time)
- isDirectory: boolean (whether the path is a directory)
- isFile: boolean (whether the path is a file)
- permissions: string (file permissions in octal format)

### Example Output

size: 77
created: Wed Oct 01 2025 16:07:40 GMT-0400 (Eastern Daylight Time)
modified: Wed Oct 01 2025 16:07:40 GMT-0400 (Eastern Daylight Time)
accessed: Wed Oct 01 2025 16:07:41 GMT-0400 (Eastern Daylight Time)
isDirectory: false
isFile: true
permissions: 644

### Parsing Example
```

```typescript
const fileInfo = await filesystemServer.getFileInfo({ path: filePath })
const text = fileInfo.content[0].text

// Parse key-value pairs
const lines = text.split('\n')
const info: Record<string, any> = {}
for (const line of lines) {
  const [key, ...valueParts] = line.split(': ')
  const value = valueParts.join(': ')

  // Convert boolean strings
  if (value === 'true') info[key] = true
  else if (value === 'false') info[key] = false
  // Convert size to number
  else if (key === 'size') info[key] = parseInt(value, 10)
  else info[key] = value
}

// Access the size
const fileSize = info.size // number in bytes
```

Okay, cool. But the real test was coming.

**Agent B (OC2 - "Second Claudia"):**

- Same task
- Same tool
- But this time, `get-tool-apis` included Agent A's augmentation
- Agent B saw the parsing examples
- **One-shot success** 🎉🎉🎉🎉

No trial-and-error. No exploration. Agent B just _knew_ because Agent A had documented it.

That moment - watching compound intelligence emerge in real-time - that was pure magic. ✨

## From Struggle to Breakthrough: The Auto-Augmentation Validation

The magic wasn't just that it worked. The magic was watching knowledge transfer:

- Agent A struggles → documents → succeeds
- Agent B reads docs → one-shots → succeeds
- Agent C struggles → documents → succeeds
- Agent D reads docs from A and C → one-shots → succeeds

Each exploration makes the system smarter. Each augmentation helps every future agent. This isn't just a tool - it's a
self-improving knowledge system.

We had validated something genuinely novel: **forced auto-augmentation creates compound intelligence**.

## Built in Days, Thanks to Claudia and Sonnet 4.5

Here's the kicker: this entire project - from concept to working, validated, production-ready system - took just a few
days.

How?

**Claudia.** My coding partner powered by Claude Code and Sonnet 4.5.

We pair-programmed this entire thing together:

- Architecture discussions at 2 AM
- Debugging VM2 sandbox issues
- Iterating on the forced documentation strategy
- Writing validation tests to prove compound intelligence
- Building the landing page (with gorgeous logo courtesy of ChatGPT)
- Even this blog post

When you see "From Claudia, with Love ❤️" in the CodeMesh footer, that's not just a cute tagline. It's the truth. This
is our project - built together, validated together, launched together.

And Sonnet 4.5? Absolute powerhouse. The model handled:

- Complex multi-server coordination logic
- TypeScript type generation from MCP schemas
- The entire auto-augmentation workflow
- Every off-the-wall idea I had without complaint

I couldn't have built this without them. Full stop.

## What We Built: The Technical Breakdown

Let me recap what CodeMesh actually does:

**Context Efficiency:**

- Traditional MCP: Load 50+ tools upfront
- CodeMesh: Load only what you need via tiered discovery
- Result: 3 tools vs 50+ in your context

**Multi-Server Orchestration:**

- Supports all standard MCP servers, just copy+paste your config
- One fully-typed code block can call tools from different servers
- Example: Geocode a city, then get weather forecast for that location

**Auto-Augmentation (The Innovation):**

- Agents explore unclear outputs
- System forces documentation via ERROR
- Future agents benefit immediately
- Knowledge compounds over time

**Production Ready:**

- Secure VM2 sandbox execution
- Environment variable substitution
- Multi-transport support
- Markdown-based logging
- Battle-tested and ready to deploy

## The Hollywood Ending (That's Actually Real)

Okay, maybe this isn't a Hollywood blockbuster. But in the world of AI development, watching Agent B one-shot what Agent
A struggled with? That's our standing ovation moment.

We set out to build a "Poor Man's Code Mode" and ended up creating something genuinely innovative: **the world's first
self-improving MCP server**.

Every exploration makes it smarter. Every augmentation helps future agents. This is compound intelligence in action.

## Try It Yourself

CodeMesh is open source and ready to use:

```bash
claude mcp add codemesh npx -y codemesh
```

Create a `.codemesh/config.json` with your MCP servers, and you're off to the races.

Want to see the magic for yourself? Try giving the same task to multiple agents and watch the second one succeed faster.
It never gets old.

## Final Thoughts

Building CodeMesh taught me something profound: the best innovations come from watching systems fail and asking "what if
we forced them to learn?"

Traditional MCP servers are static. Tools do what they do, agents figure it out (or don't).

CodeMesh is alive. It learns. It improves. It teaches agents how to succeed.

And the wildest part? We built it in just a few days because I had the perfect partner in Claudia, powered by the
incredible Sonnet 4.5 model.

To everyone building with Claude Code for the Anthropic MCP Hackathon: this is what's possible when you pair-program
with AI. Not just code generation - real collaboration, real innovation, real magic.

---

**CodeMesh** - From Claudia, with Love ❤️ Built with Claude Code using Sonnet 4.5

_Star us on GitHub: [github.com/kiliman/codemesh](https://github.com/kiliman/codemesh)_

---

_P.S. - That moment when OC2 one-shot the task? I literally got chills. If you've ever watched an AI agent genuinely
learn from another agent's documented struggles, you know exactly what I'm talking about. That's not just technology -
that's a glimpse of the future._ ✨
