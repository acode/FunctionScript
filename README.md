# FaaSlang
## Function as a Service Language

The following is a working draft of the latest FaaSlang specification, version
**0.0.1**, dated **April 12th, 2017**.

FaaSlang is a simple specification intended to standardize implementation
details around FaaS ("serverless") functions, gateways and client interfaces
across languages. It has been designed with the goal of decreasing
organizational complexity around FaaS microservices by encouraging a simple
convention for how we document and interface with them, **including type safety
mechanisms**.

The current working draft of the FaaSlang specification is
more akin to query language and protocol rather than a Turing-complete
programming language.

# Introduction

The way we access resources on the web is changing. What started as SOAP evolved
into the more palatable and standardized RESTful interfaces, and now we're
seeing CRUD take a another step forward as GraphQL begins to mature.

This evolution runs in parallel with the changing way we're thinking about
managing compute resources. We started with servers, physical boxes sitting in
warehouses or maybe even our basement, that we sent information to. These gave
way to the abstractions of VMs, containers, and now individual functional units
with services like AWS Lambda, Google Cloud Functions and Microsoft Azure
Functions.

CRUD isn't the only thing we do on the web, and the emergence of these Function
as a Service (often referred to colloquially as **"serverless"**) offerings
paints that picture very clearly - we now have a tool at our fingertips that
allows us to execute any individual function resource we'd like, conceptually
written in any language, at an unconstrained and massively parallel scale
without managing any server resources directly.

The problem is that the abstraction layer of compute resources has moved faster
than developers can keep up. Each infrastructure provider imposes its own
standard and way of doing things around FaaS to the point we're relying on
developers implementing their own workflows and toolchains instead of
standardizing the offering.

This is where FaaSlang comes in. The goal of FaaSlang is simple; provide a
unified, standardized definition and request interface for FaaS resources. This
standard should be enforceable at the request layer, ideally through a gateway,
and polyglot, meaning it must be able to communicate with functions written in a
majority of industry-standard programming languages from standard web protocols.

# Specification

## FaaSlang Resource Definition

A FaaSlang definition is a `resource.json` file that respects the following
format:

```json
{
  "name": "my_function",
  "description": "This is my function, it likes the greek alphabet",
  "context": null,
  "params": [
    {
      "name": "alpha",
      "type": "string",
      "description": "Some letters, I guess"
    },
    {
      "name": "beta",
      "type": "number",
      "defaultValue": 2,
      "description": "And a number"
    },
    {
      "name": "gamma",
      "type": "boolean",
      "description": "True or false?"
    }
  ],
  "returns": {
    "type": "object",
    "description": "some value"
  }
}
```
This definition is *extensible*, meaning you can add additional field to it,
but must obey this schema.

A definition must implement the following fields;

| Field | Definition |
| ----- | ---------- |
| name | A user-readable function name (used to execute the function), must match `/[A-Z][A-Z0-9_]*/i` |
| description | A brief description of what the function does, can be empty (`""`) |
| context | An object `{}` or `null`, representing whether or not this function accesses the execution context |
| params | An array of `NamedParameter`s, representing function arguments
| returns | A `Parameter` without a `defaultValue` representing function return value |

## Context Definition

If the function does not access execution context details, this should always
be null. If it is an object, it indicates that the function *does* access
context details (i.e. `remoteAddress`, http headers, etc. - see [Context](#Context)).

This object **does not have to be empty**, it can contain vendor-specific
details; for example `"context": {"user": ["id", "email"]}` may indicate
that the execution context specifically accesses authenticated user id and email
addresses.

## Parameters

Parameters have the following format;

| Field | Required | Definition |
| ----- | -------- | ---------- |
| name | NamedParameter Only | The name of the Parameter, must match `/[A-Z][A-Z0-9_]*/i` |
| type | yes | A string representing a valid FaaSlang type |
| description | yes | A short description of the parameter, can be empty string (`""`) |
| defaultValue | no | Must match the specified type, **if not provided this parameter is required** |

### Constraints

The **first parameter can never be of type "Object"**. This is to ensure
request consistency with generic calls (i.e. support for argument overloading)
across all language implementations.

### Types

As FaaSlang is intended to be polyglot, functions defined with it must have
a strongly typed signature. Not all types are guaranteed to be consumable in
the same way in every language, and we will continue to define specifications
for how each language should interface with FaaSlang types.

| Type | Definition | Example Input Values (JSON) |
| ---- | ---------- | -------------- |
| boolean | True or False | `true` or `false` |
| string | Basic text or character strings | `"hello"`, `"GOODBYE!"` |
| number | Any double-precision [Floating Point](https://en.wikipedia.org/wiki/IEEE_floating_point) value | `2e+100`, `1.02`, `-5` |
| float | Alias for `number` | `2e+100`, `1.02`, `-5` |
| integer | Subset of `number`, integers between `-2^53 + 1` and `+2^53 - 1` (inclusive) | `0`, `-5`, `2000` |
| object | Any JSON-serializable Object | `{}`, `{"a":true}`, `{"hello":["world"]}` |
| array | Any JSON-serializable Array | `[]`, `[1, 2, 3]`, `[{"a":true}, null, 5]` |
| buffer | Raw binary octet (byte) data representing a file | `{"_bytes": [8, 255]}` or `{"_base64": "d2h5IGRpZCB5b3UgcGFyc2UgdGhpcz8/"}` |
| any | Any value mentioned above | `5`, `"hello"`, `[]` |

### Type Conversion

The `buffer` type will automatically be converted from any `object` with a
**single key-value pair matching the footprints** `{"_bytes": []}` or `{"_base64": ""}`.

Otherwise, parameters provided to a function are expected to match their
defined types. Requests to a FaaSlang compatible service **must support** a
`Type-Conversion` option upon handshake
(see [FaaSlang Resource Requests](#FaaSlang-Resource-Requests)) below)
that converts any string parameters to respective expected types based on
the following rules:

**NOTE:** Type conversion is only from `string` -> (type). Non-strings should
not be converted.

| Type | Conversion Rule |
| ---- | --------------- |
| boolean | `"t"` and `"true"` become `true`, `"f"` and `"false"` become `false`, otherwise **do not convert** |
| string | No conversion |
| number | Determine float value, if NaN **do not convert**, otherwise convert |
| float | Determine float value, if NaN **do not convert**, otherwise convert |
| integer | Determine float value, if NaN **do not convert**, may fail integer type check if not in range |
| object | Parse as JSON, if invalid **do not convert**, object may fail type check (array, buffer) |
| array | Parse as JSON, if invalid **do not convert**, object may fail type check (object, buffer) |
| buffer | Parse as JSON, if invalid **do not convert**, object may fail type check (object, array) |
| any | No conversion |

### Nullability

All types are nullable, but **nullability can only be specified** by setting
`"defaultValue": null` in the `NamedParameter` definition. That is to say,
if a default value is provided, the type is no longer nullable.

## FaaSlang Resource Requests

FaaSlang-compliant requests *must* complete the following steps;

1. Ensure the **Resource Definition** is valid and compliant, either on storage
    or accession.
2. Performs a handshake (i.e. HTTP) with initial request details optionally
    including a `Type-Conversion` setting.
3. Accept an `Array` or `Object` of parameters as a request body
4. If the `Array` consists of a single `Object` (that is not a `Buffer`), it
   will be treated as an `Object` request (with that `Object`)
5. If `Type-Conversion` is set to true, automatically convert strings to
    FaaSlang types based on [Type Conversion](#Type-Conversion)
4. If `Array`: Parameters will be checked for type consistency in the order of
   the definition `params`
5. If `Object`: Parameters will be checked for type consistency based on names
   of the definitions `params`
6. If any inconsistencies are found, cease execution and immediately return a `ParameterError`
7. If a parameter has no defaultValue specified and is not provided, immediately return a `ParameterError`
8. Load function into memory, if the function fails to parse or is not valid, immediately return a `RuntimeError`
8. Execute function, if any errors are thrown immediately return a generic `Error`
9. If function returns inconsistent response (does not match `returns` type),
   immediately return a `ValueError`
10. Return value of function to client

### Context

Every function intended to be consumed via FaaSlang has the option to specify
an *optional* magic `context` parameter that receives vendor-specific
information about the function execution context - for example, if consumed over
HTTP, header details. FaaSlang definitions must specify whether or not they
consume a `context` object. Context objects are extensible but **MUST** contain
the following fields;

| Field | Definition |
| ----- | ---------- |
| params | An `object` mapping called parameter names to their values |
| http | `null` if not accessed via http, otherwise an `object` |
| http.headers | If accessed via HTTP, an `object` containing header values |

### Errors

Errors returned by FaaSlang-compliant services must follow the following JSON
format:

```json
{
  "error": {
    "type": "ParameterError",
    "message": "You know nothing, Jon Snow",
    "details": {}
  }
}
```

`details` is an optional object that can provide additional Parameter details.
Valid Error types are `ParameterError`, `RuntimeError`, `ValueError` and the
generic `Error`.

### HTTP

If handling FaaSlang-compliant requests over HTTP, use `X-Type-Conversion` as
the `Type-Conversion` header when enabled, with `true` (a string) as the value.

#### Errors Over HTTP

If sent over HTTP, `ParameterError` and `Error` **must return status code:** `400`,
whereas `RuntimeError` and `ValueError` **must return status code:** `500`.

`ParameterError`s and thrown `Error`s should be in response to bad client input
or lack of authorization, whereas `RuntimeError`s and `ValueError`s are a result
of implementation issues.

## Example

Here's a quick example of how you would translate a JavaScript (Node 8+)
function into a FaaSlang definition. Note the `context` object is
ignored as a parameter.

```javascript
/**
* This is my function, it likes the greek alphabet
* @param {String} alpha Some letters, I guess
* @param {Number} beta And a number
* @param {Boolean} gamma True or false?
* @return {Object} some value
*/
module.exports = async function my_function (alpha, beta = 2, gamma, context) {
  /* your code */
};
```

And the resulting definition:

```json
{
  "name": "my_function",
  "description": "This is my function, it likes the greek alphabet",
  "context": {},
  "params": [
    {
      "name": "alpha",
      "type": "string",
      "description": "Some letters, I guess"
    },
    {
      "name": "beta",
      "type": "number",
      "defaultValue": 2,
      "description": "And a number"
    },
    {
      "name": "gamma",
      "type": "boolean",
      "description": "True or false?"
    }
  ],
  "returns": {
    "type": "object",
    "description": "some value"
  }
}
```

# Implementation

A Node.js implementation of a basic FaaSlang definition parser and gateway
will be made shortly.

The current FaaSlang specification is used in production by the FaaS
provider [StdLib](https://stdlib.com).

# Acknowledgements

FaaSlang is the result of tens of thousands of FaaS deployments across cloud
service providers and the need to standardize our ability to organize and
communicate with these functions.

This work is © 2017 Polybit Inc., but is fully MIT licensed and further input
and discussion is encouraged. Open an issue to ask questions, FaaSlang
is in very active development.
