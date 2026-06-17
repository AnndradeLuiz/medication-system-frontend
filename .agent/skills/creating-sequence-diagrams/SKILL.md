---
name: creating-sequence-diagrams
description: Use when the user requests a sequence diagram or when you need to document flows, interactions, or component lifecycles visually
---

# creating-sequence-diagrams

## Overview
This skill provides the correct syntax and formatting rules for SequenceDiagram.org. It ensures that any sequence diagram generated for the user uses the specific features, styling, and structural elements natively supported by this platform.

## When to Use
- Use when the user explicitly asks for a sequence diagram.
- Use when you need to document flows, interactions, or component lifecycles visually.
- Do NOT use for UML class diagrams, state diagrams, or flowchart generic graphs (unless explicitly requested via a sequence diagram).

## Quick Reference

| Element | Syntax |
| --- | --- |
| **Title** | `title My Title` |
| **Participants** | `participant Alice`, `actor Bob`, `database DB` |
| **Messages** | `A->B: sync`, `A->>B: async`, `A<--B: reply` |
| **Notes** | `note over A: text`, `note right of A: text` |
| **Fragments** | `alt`, `opt`, `loop`, `par` ... `end` |
| **Creation/Destroy**| `A->*B: <<create>>`, `destroy B` |

## Core Syntax Details

### Participants
- Valid types: `participant`, `rparticipant` (rounded), `actor`, `boundary`, `control`, `database`, `entity`.
- Icons: `materialdesignicons [CODE] [name]`, `fontawesome6solid [CODE] [name]`.
- Aliasing & Styling: `actor "Long Name" as Alice #red`
- Note: The display name can be used to style the participant name or add line breaks.

### Messages
- Synchronous: `A->B: message`
- Asynchronous: `A->>B: message`
- Return: `A<--B: return` or `A<<--B: async return`
- Non-instantaneous (delayed): `A->(1)B: message`
- Failure messages: `A-xB: error`
- Self-message: `A->A: internal`
- Line weight and color: `A-[#red;4]->B: message`

### Fragments
Used to enclose a group of interactions:
```text
alt success case
  A->B: success
else failure case
  A->B: failure
end

opt optional case
  A->B: opt
end

loop 10 times
  A->B: retry
end
```

### Advanced Features
- **Auto Activation:** Use `autoactivation on` to automatically activate on request and deactivate on response. (Turn off with `autoactivation off`).
- **Manual Activation:** `activate A` and `deactivate A` or `deactivateafter A`.
- **Boxes:** `box over A,B: label` or `rbox` for rounded boxes.
- **Text Styling:** `**bold**`, `//italic//`, `++large++`, `--small--`, `<color:#red>text</color>`, `""monospaced""`.
- **Comments:** Use `#` or `//` at the start of a line.

## Example

```text
title Login Flow
autoactivation on

actor User
participant "API Gateway" as API
database DB

User->API: POST /login
API->DB: SELECT user
alt user found
    DB-->API: user data
    API-->User: 200 OK + Token
else user not found
    DB-->API: null
    API-xUser: 401 Unauthorized
end
autoactivation off
```

## Common Mistakes
- **Using unsupported plantuml syntax:** Always stick to the specific syntax of SequenceDiagram.org shown above.
- **Using standard markdown links for images:** If an image is needed, use `image data:image/png;base64,... png participant`.
- **Incorrect activation nesting:** Ensure that every `activate` has a corresponding `deactivate` or `deactivateafter` if you are doing it manually.
