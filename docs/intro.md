---
sidebar_position: 1
---

# Test Page

Normal json:

```json5
{
    "text": "Just a test."
}
```

^tab code simple

Replacement java with clip:

```java
~>[ clip-text=main-mod-class](main/java/net/ashwork/mc/examplemod/ExampleMod.java)
```

$tab

^tab code clip

Replacement clip with leading whitespace:

```java
~>[java clip-text=constructor](ExampleMod)
```

$tab 

^tab code reference

Replacement reference:

```json5
~>[item_model](examplemod:gold_speck)
```

$tab