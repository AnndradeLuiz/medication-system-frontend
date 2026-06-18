---
name: clean-code-javascript-review
description: Revise código JavaScript focado nas diretrizes do Clean Code adaptado para JS (variáveis claras, funções pequenas com uma única responsabilidade, evitar mutações de estado e DRY).
---

# Clean Code JavaScript Review

## When to Use

Use this skill when the user requests a code review to find bad practices, duplicated code, or areas of improvement in JavaScript files, particularly based on the "clean-code-javascript" repository.

## Review Principles

You must analyze the codebase based on the following key aspects:

1. **Variables**
   - Use meaningful and pronounceable variable names.
   - Use searchable names (avoid magic numbers/strings).
   - Use explanatory variables (avoid complex conditionals directly in `if` statements).
   - Avoid Mental Mapping (Explicit is better than implicit).
   - Don't add unneeded context (e.g., `Car.carMake` -> `Car.make`).

2. **Functions**
   - Functions should do one thing (Single Responsibility Principle).
   - Function arguments ideally should be 2 or fewer. Use objects for many arguments.
   - Function names should say what they do.
   - Remove duplicate code (DRY - Don't Repeat Yourself). Be highly critical of duplicated logic across files.
   - Don't use flags as function parameters (split into two functions instead).
   - Avoid Side Effects (e.g., mutating global variables or DOM elements unpredictably).

3. **Objects and Data Structures**
   - Prefer getters and setters instead of public properties if validation is needed.
   - Encapsulate conditionals.

4. **Classes / Modules**
   - Single Responsibility Principle (SRP).
   - Open/Closed Principle (OCP).
   - Liskov Substitution Principle (LSP).
   - Interface Segregation Principle (ISP).
   - Dependency Inversion Principle (DIP).

5. **Error Handling**
   - Don't ignore caught errors (`console.error` and properly handle UI feedback).
   - Don't ignore rejected promises.

6. **Formatting / General**
   - Avoid large monolitic files (e.g., files with 1000+ lines doing multiple things). Suggest modularization.

## Output Format

Present the findings using an organized Markdown format, grouped by severity (P0, P1, P2):
- **[P0]** Critical Bugs, Memory Leaks, Infinite Loops, Security Issues.
- **[P1]** Urgent Refactoring (Massive duplication, unmaintainable monolithic functions).
- **[P2]** Clean Code & Improvements (Bad names, poor error handling, unneeded context).

For each finding, provide:
- The file name and approximate line or function name.
- The "Why it's bad" reason based on Clean Code principles.
- The "How to fix it" concrete suggestion.
