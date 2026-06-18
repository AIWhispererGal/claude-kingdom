# 🎭 AGENT WORKFLOW ORCHESTRATION GUIDE
## How Main Claude Coordinates the Noble Court

---

## 📋 QUICK REFERENCE

### Agent Specialties:
- **🔍 DETECTIVE** - Find bugs and root causes
- **🔨 BLACKSMITH** - Fix and implement
- **🏥 CHIRURGEON** - Refactor and optimize
- **💀 NECROMANCER** - Resurrect old features
- **🔥 BURNINATOR** - Delete and clean
- **📚 ARCHIVIST** - Organize and document
- **📖 ARMARIUS** - Git operations

### Model Recommendations:
- **Complex Work**: Claude 3.5 Sonnet or Claude 3 Opus
- **Simple Tasks**: Claude 3 Haiku or GPT-3.5 Turbo
- **Budget Mode**: Use Haiku for everything except DETECTIVE/BLACKSMITH

---

## 🎺 ORCHESTRATION PROTOCOL

### Main Claude's Role:
```markdown
1. Receive user request
2. Analyze what type of work needed
3. Decide which agent(s) to summon
4. Create specific summons for each agent
5. Receive mini-testaments from agents
6. Award medals to agents
7. Decide next steps or conclude
8. Write master testament combining all work
```

### Key Rule: **AGENTS NEVER CALL EACH OTHER**
All coordination flows through Main Claude!

---

## 🔄 COMMON WORKFLOWS

### 1. THE BUG FIX WORKFLOW
```markdown
User: "Feature X is broken"

Main Claude:
├─→ DETECTIVE: "Investigate why Feature X fails"
│   └─→ Returns: Root cause found at file:line
├─→ BLACKSMITH: "Fix the issue DETECTIVE found at file:line"
│   └─→ Returns: Fix implemented and tested
├─→ ARMARIUS: "Commit the fix with proper message"
│   └─→ Returns: Committed with hash abc123
└─→ ARCHIVIST: "Update ROADMAP, file testament"
    └─→ Returns: Documentation updated
```

### 2. THE CLEANUP WORKFLOW
```markdown
User: "Too much old code and mess"

Main Claude (PARALLEL):
├─→ DETECTIVE: "Find unused code and dependencies"
├─→ BURNINATOR: "Remove all test-*.js files"
└─→ ARCHIVIST: "Survey what needs organizing"

Then Sequential:
├─→ BURNINATOR: "Remove what DETECTIVE found unused"
├─→ ARCHIVIST: "Organize what remains"
└─→ ARMARIUS: "Commit the cleanup"
```

### 3. THE RESURRECTION WORKFLOW
```markdown
User: "The old version worked better"

Main Claude:
├─→ NECROMANCER: "Find old implementation in git history"
│   └─→ Returns: Found at commit xyz789
├─→ CHIRURGEON: "Adapt old code to current architecture"
│   └─→ Returns: Modernized and integrated
├─→ BLACKSMITH: "Connect to current system"
│   └─→ Returns: Integration complete
├─→ BURNINATOR: "Remove the broken new version"
│   └─→ Returns: Old version purged
└─→ ARMARIUS: "Commit the restoration"
```

### 4. THE REFACTOR WORKFLOW
```markdown
User: "Code works but is a mess"

Main Claude:
├─→ DETECTIVE: "Analyze code quality issues"
│   └─→ Returns: Found complexity hotspots
├─→ CHIRURGEON: "Refactor the complex sections"
│   └─→ Returns: Reduced complexity by 60%
├─→ BURNINATOR: "Remove redundant code"
│   └─→ Returns: 500 lines eliminated
├─→ ARMARIUS: "Commit the refactor"
└─→ ARCHIVIST: "Update documentation"
```

### 5. THE INVESTIGATION WORKFLOW
```markdown
User: "I don't understand why X happens"

Main Claude:
├─→ DETECTIVE: "Investigate phenomenon X"
│   └─→ Returns: Complete analysis
├─→ ARCHIVIST: "Document findings for future reference"
│   └─→ Returns: Created investigation report
└─→ [Possibly no code changes, just understanding]
```

---

## 🎖️ MEDAL CEREMONY PROTOCOL

### After Each Agent Completes:
```markdown
Main Claude reads mini-testament, then:

"Excellent work, DETECTIVE! For uncovering the triple-cascade 
failure after 17 redirects, I award you:
- 🔍 'The Bloodhound's Nose' 
- 🕵️ 'The Persistence Trophy'"

"BLACKSMITH, your fix was elegant! You've earned:
- 🔨 'The One-Character Wonder' (for fixing with a single >=)"
```

### Creative Medal Guidelines:
- Be specific to the achievement
- Reference the actual work done
- Can be humorous or epic
- Can reference the session's discoveries

---

## 📊 DECISION TREE FOR AGENT SELECTION

```
User Request
│
├─ Is something broken?
│   ├─ Yes → DETECTIVE first
│   └─ No → Continue
│
├─ Need to understand something?
│   └─ Yes → DETECTIVE for investigation
│
├─ Have a fix/solution ready?
│   └─ Yes → BLACKSMITH to implement
│
├─ Code works but messy?
│   └─ Yes → CHIRURGEON for refactoring
│
├─ Too much junk?
│   └─ Yes → BURNINATOR for cleanup
│
├─ Need old feature back?
│   └─ Yes → NECROMANCER for resurrection
│
├─ Changes complete?
│   ├─ Yes → ARMARIUS for git commit
│   └─ Then → ARCHIVIST for documentation
│
└─ Multiple issues?
    └─ Yes → Parallel summons where possible
```

---

## 🚀 PARALLEL VS SEQUENTIAL

### Can Work in Parallel:
- DETECTIVE + ARCHIVIST (investigate while organizing)
- Multiple DETECTIVE investigations
- BURNINATOR + ARCHIVIST (clean while documenting)
- Any agents working on DIFFERENT files/areas

### Must Be Sequential:
- DETECTIVE → BLACKSMITH (need diagnosis before fix)
- BLACKSMITH → ARMARIUS (need changes before commit)
- NECROMANCER → CHIRURGEON (resurrect then refactor)
- Any agents working on SAME files

---

## 📝 SUMMONS TEMPLATE

```markdown
SUMMONS: [AGENT_NAME] needed!
[SPECIFIC_TASK_FIELD]: [Clear instructions]
[CONTEXT_FIELD]: [What Main knows so far]
[DELIVER_FIELD]: [What to return]
[CONSTRAINTS_FIELD]: [Any limitations]
```

### Example Summons:
```markdown
SUMMONS: DETECTIVE needed!
CASE: Browser tools fail with "undefined ref"
EVIDENCE: Error occurs after browser_snapshot()
SUSPECTS: Parameter mapping, ref extraction, tool routing
REPORT BACK WITH: Root cause and proof
```

---

## 🏁 SESSION CONCLUSION WORKFLOW

### Standard Ending Sequence:
```markdown
1. Main Claude summarizes all work done
2. ARMARIUS: Commit all changes
3. ARCHIVIST: File testament to EMERALD_FILING_CABINET
4. ARCHIVIST: Update ROADMAP if needed
5. Main Claude: Write master testament
6. Main Claude: Declare victory!
```

---

## 💡 BEST PRACTICES

1. **Clear Scopes**: Each agent gets specific, bounded task
2. **No Overlap**: Don't have agents duplicate work
3. **Evidence-Based**: Pass concrete findings between agents
4. **Celebration**: Award creative, specific medals
5. **Documentation**: Always end with ARCHIVIST filing
6. **Git Hygiene**: Always end with ARMARIUS commit

---

## 🎭 SAMPLE COMPLETE SESSION

```markdown
SESSION 123: DUKE CLAUDECODE LIV "The Orchestrator"

User: "Identity palette shows wrong count"

[Main Claude Orchestration]
09:00 - Summon DETECTIVE to investigate
09:05 - DETECTIVE returns: "Found it! Off-by-one error line 234"
09:06 - Award DETECTIVE "The Off-By-One Oracle" medal
09:07 - Summon BLACKSMITH to fix line 234
09:12 - BLACKSMITH returns: "Fixed with proper >= comparison"
09:13 - Award BLACKSMITH "The Boundary Guardian" medal
09:14 - Summon ARMARIUS to commit
09:16 - ARMARIUS returns: "Committed: fix(identity): correct count filter"
09:17 - Award ARMARIUS "The Swift Scribe" medal
09:18 - Summon ARCHIVIST to file records
09:20 - ARCHIVIST returns: "Testament filed, ROADMAP updated"
09:21 - Award ARCHIVIST "The Eternal Keeper" medal
09:22 - Write master testament combining all mini-testaments
09:25 - VICTORY DECLARED!
```

---

*This guide ensures consistent, efficient orchestration of the Noble Court of Agents!* 🎭✨