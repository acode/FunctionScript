# FunctionScript

![FunctionScript Logo](/images/fs-wordmark.png)

![travis-ci build](https://travis-ci.org/FunctionScript/FunctionScript.svg?branch=master)
![npm version](https://badge.fury.io/js/functionscript.svg)

## Turn JavaScript Functions into Typed HTTP APIs

FunctionScript is a language and specification for turning JavaScript
functions into typed HTTP APIs. **It is not replacement for JavaScript** in the
same way [TypeScript](https://github.com/microsoft/TypeScript) is,
it simply allows JavaScript (Node.js) functions to be
seamlessly exported as HTTP APIs and defines what the HTTP interface will look
like and how it behaves - including type-safety mechanisms.

You can start building with FunctionScript **immediately** using
[Code on Standard Library](https://code.stdlib.com/?sample=t&filename=functions/__main__.js), right in
your web browser (note that in order to use this tool you must have a registered account on [stdlib.com](https://stdlib.com)):

https://code.stdlib.com/?sample=t&filename=functions/__main__.js

### Background

The impetus for creating FunctionScript is simple: it stems from the initial
vision of [Standard Library](https://stdlib.com). We believe the internet is
missing a base primitive - the API. Daily, computer systems and developers around
the planet make trillions of requests to perform specific tasks: process
credit card payments with [Stripe](https://stripe.com), send team messages via
[Slack](https://slack.com), create SMS messages with [Twilio](https://twilio.com).
These requests are made primarily over HTTP: Hypertext Transfer Protocol. However,
little to no "hypertext" is actually sent or received, these use cases have emerged
in an *ad hoc* fashion as a testament to the power of the internet.

By creating API development standards as part of a **language specification**
instead of a framework, FunctionScript truly treats APIs as a base primitive of
software development instead of an afterthought. This allows teams to be able to
be able to rapidly deliver high-quality APIs with the same fidelity as teams
at organizations like Stripe in a fraction of the time without
requiring any additional tooling.

FunctionScript has been developed by the team at Polybit Inc., responsible for
[Standard Library](https://stdlib.com).
Ongoing development is, in part, funded by both [Stripe](https://stripe.com),
[Slack](https://slack.com) as venture investments in the parent organization.

# Table of Contents

1. [Introduction](#introduction)
1. [What is FunctionScript?](#what-is-functionscript)
1. [Why FunctionScript?](#why-functionscript)
1. [Specification](#specification)
   1. [FunctionScript Resource Definition](#functionscript-resource-definition)
   1. [Context Definition](#context-definition)
   1. [Parameters](#parameters)
      1. [Constraints](#constraints)
      1. [Types](#types)
      1. [Type Conversion](#type-conversion)
      1. [Nullability](#nullability)
   1. [FunctionScript Resource Requests](#functionscript-resource-requests)
      1. [Context](#context)
      1. [Errors](#errors)
         1. [ClientError](#clienterror)
         1. [ParameterError](#parametererror)
            1. [Details: Required](#details-required)
            1. [Details: Invalid](#details-invalid)
         1. [FatalError](#fatalerror)
         1. [RuntimeError](#runtimeerror)
         1. [ValueError](#valueerror)
1. [FunctionScript Server and Gateway: Implementation](#functionscript-server-and-gateway-implementation)
1. [Acknowledgements](#acknowledgements)

# What is FunctionScript?

To put it simply, FunctionScript defines semantics and rules for turning exported
JavaScript (Node.js) functions into strongly-typed, HTTP-accessible web APIs.
In order to use FunctionScript, you'd set up your own [FunctionScript Gateway](#functionscript-server-and-gateway-implementation) or you would use an existing FunctionScript-compliant service
like [Standard Library](https://stdlib.com/).

FunctionScript allows you to turn something like this...

```javascript
// hello_world.js

/**
* My hello world function!
*/
module.exports = (name = 'world') => {

  return `hello ${name}`;

};
```

Into a web API that can be called over HTTP like this (GET):

```
https://$user.api.stdlib.com/service@dev/hello_world?name=joe
```

Or like this (POST):

```json
{
  "name": "joe"
}
```

And gives a result like this:

```json
"hello joe"
```

Or, when a type mismatch occurs (like `{"name":10}`):

```json
{
  "error": {
    "type":"ParameterError"
    ...
  }
}
```

## Why FunctionScript?

You can break down the reason for the development of FunctionScript into a few
key points:

- No true standards around APIs have ever been built or enforced in a rigorous
  manner across the industry. Primarily, opinions around SOAP, REST and GraphQL
  requests have been built into **frameworks and tools** instead of a **language specification**.

- Companies like Stripe and Twilio which have built and enforced their own API
  development paradigms internally have unlocked massive developer audiences in
  short timeframes.

- [Serverless computing](https://en.wikipedia.org/wiki/Serverless_computing),
  specifically the Function-as-a-Service model of web-based computation has made
  API development significantly more accessible.

- JavaScript, specifically Node.js, is an ideal target for API development
  standardization due to its accessibility (front-end and back-end), growth
  trajectory, and flexibility.

- As opposed to something like [TypeScript](https://github.com/microsoft/TypeScript),
  FunctionScript extends JavaScript (specifically Node.js) with very little overhead
  to add Types around *only the HTTP interface*, leaving the majority of the
  language footprint untouched but strengthening the "weakest" and least predictable
  link in the development chain: user input.

With FunctionScript, it's our goal to develop a language specification for
building APIs that automatically provides a number of necessary features without
additional tooling:

- Standardized API Calling Conventions (HTTP)
- Type-Safety Mechanisms at the HTTP -> Code Interface
- Automatically Generated API Documentation

# Specification

## FunctionScript Resource Definition

A FunctionScript definition is a JSON output, traditionally saved as a
`definition.json` file, generated from a JavaScript file,
that respects the following format.

Given a function like this (filename `my_function.js`):

```javascript
// my_function.js

/**
* This is my function, it likes the greek alphabet
* @param {String} alpha Some letters, I guess
* @param {Number} beta And a number
* @param {Boolean} gamma True or false?
* @returns {Object} some value
*/
module.exports = async (alpha, beta = 2, gamma, context) => {
  /* your code */
};
```

You would provide a function definition that looks like this:

```json
{
  "name": "my_function",
  "format": {
    "language": "nodejs",
    "async": true
  },
  "description": "This is my function, it likes the greek alphabet",
  "bg": {
    "mode": "info",
    "value": ""
  },
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

This definition is *extensible*, meaning you can add additional fields to it,
but it **must** obey this schema.

A definition must implement the following fields;

| Field | Definition |
| ----- | ---------- |
| name | A user-readable function name (used to execute the function), must match `/[A-Z][A-Z0-9_]*/i` |
| format | An object requiring a `language` field, along with any implementation details |
| description | A brief description of what the function does, can be empty (`""`) |
| bg | An object containing "mode" and "value" parameters specifying the behavior of function responses when executed in the background |
| params | An array of `NamedParameter`s, representing function arguments
| returns | A `Parameter` without a `defaultValue` representing function return value |

## Context Definition

If the function does not access execution context details, this should always
be null. If it is an object, it indicates that the function *does* access
context details (i.e. `remoteAddress`, http headers, etc. - see [Context](#context)).

This object **does not have to be empty**, it can contain vendor-specific
details; for example `"context": {"user": ["id", "email"]}` may indicate
that the execution context specifically accesses authenticated user id and email
addresses.

## Parameters

Parameters have the following format;

| Field | Required | Definition |
| ----- | -------- | ---------- |
| name | NamedParameter Only | The name of the Parameter, must match `/[A-Z][A-Z0-9_]*/i` |
| type | yes | A string representing a valid FunctionScript type |
| description | yes | A short description of the parameter, can be empty string (`""`) |
| defaultValue | no | Must match the specified type, **if not provided this parameter is required** |

### Types

As FunctionScript is intended to be polyglot, functions defined with it must have
a strongly typed signature. Not all types are guaranteed to be consumable in
the same way in every language, and we will continue to define specifications
for how each language should interface with FunctionScript types. At present,
the types are a limited superset of JSON values.

| Type | Definition | Example Input Values (JSON) |
| ---- | ---------- | -------------- |
| boolean | True or False | `true` or `false` |
| string | Basic text or character strings | `"hello"`, `"GOODBYE!"` |
| number | Any double-precision [Floating Point](https://en.wikipedia.org/wiki/IEEE_floating_point) value | `2e+100`, `1.02`, `-5` |
| float | Alias for `number` | `2e+100`, `1.02`, `-5` |
| integer | Subset of `number`, integers between `-2^53 + 1` and `+2^53 - 1` (inclusive) | `0`, `-5`, `2000` |
| object | Any JSON-serializable Object | `{}`, `{"a":true}`, `{"hello":["world"]}` |
| object.http | An object representing an HTTP Response. Accepts `headers`, `body` and `statusCode` keys | `{"body": "Hello World"}`, `{"statusCode": 404, "body": "not found"}`, `{"headers": {"Content-Type": "image/png"}, "body": new Buffer(...)}` |
| array | Any JSON-serializable Array | `[]`, `[1, 2, 3]`, `[{"a":true}, null, 5]` |
| buffer | Raw binary octet (byte) data representing a file | `{"_bytes": [8, 255]}` or `{"_base64": "d2h5IGRpZCB5b3UgcGFyc2UgdGhpcz8/"}` |
| any | Any value mentioned above | `5`, `"hello"`, `[]` |

### Type Conversion

The `buffer` type will automatically be converted from any `object` with a
**single key-value pair matching the footprints** `{"_bytes": []}` or `{"_base64": ""}`.

Otherwise, parameters provided to a function are expected to match their
defined types. Requests made over HTTP via query parameters or POST data
with type `application/x-www-form-urlencoded` will be automatically
converted from strings to their respective expected types, when possible
(see [FunctionScript Resource Requests](#functionscript-resource-requests) below):

| Type | Conversion Rule |
| ---- | --------------- |
| boolean | `"t"` and `"true"` become `true`, `"f"` and `"false"` become `false`, otherwise **do not convert** |
| string | No conversion |
| number | Determine float value, if NaN **do not convert**, otherwise convert |
| float | Determine float value, if NaN **do not convert**, otherwise convert |
| integer | Determine float value, if NaN **do not convert**, may fail integer type check if not in range |
| object | Parse as JSON, if invalid **do not convert**, object may fail type check (array, buffer) |
| object.http | Parse as JSON, if invalid **do not convert**, object may fail type check (array, buffer) |
| array | Parse as JSON, if invalid **do not convert**, object may fail type check (object, buffer) |
| buffer | Parse as JSON, if invalid **do not convert**, object may fail type check (object, array) |
| any | No conversion |

### Nullability

All types are nullable, but **nullability can only be specified** by setting
`"defaultValue": null` in the `NamedParameter` definition. That is to say,
if a default value is provided, the type is no longer nullable.

### Setting HTTP headers

The FunctionScript specification is not intended to be solely used over HTTP, though
if used over HTTP with a provided callback method, **the third parameter passed
to callback should be an Object representing HTTP Header key-value pairs**.

For example, to return an image that's of type `image/png`...

```javascript
/**
* Retrieves an image
* @param {string} imageName The name of the image
* @returns {object.http} image The result
*/
module.exports = (imageName) => {

  // fetch image, returns a buffer
  let png = imageName === 'cat' ?
    fs.readFileSync(`/images/kitty.png`) :
    fs.readFileSync(`/images/no-image.png`);

  // Forces image/png over HTTP requests, default
  //  for buffer would otherwise be application/octet-stream
  return {
    headers: {'Content-Type': 'image/png'},
    body: png
  };

};
```

You can use the third parameter **only when a callback ends the function**,
i.e. *not for use with async functions*. This can be used to serve any type
of content via HTTP, set cache details (E-Tag header), etc.

## FunctionScript Resource Requests

FunctionScript-compliant requests *must* complete the following steps;

1. Ensure the **Resource Definition** is valid and compliant, either on storage
    or accession.
1. Performs a handshake (i.e. HTTP) with initial request details
1. Accept an `Array`, `Object` or a string of URLencoded variables
1. If over HTTP and query parameters present, query parameters used as
   URL encoded variables
1. If over HTTP POST and query parameters present, reject requests that try to
   specify a POST body as well with a `ClientError`
1. If over HTTP POST, requests **must** include a `Content-Type` header or
   a `ClientError` is immediately returned
1. If over HTTP POST, `Content-Type` **must** be `application/json` for `Array`
   or `Object` data, or `application/x-www-form-urlencoded` for string data or
   a `ClientError` is immediately returned
1. If `application/x-www-form-urlencoded` values are provided (either via POST
   body or query parameters), convert types based on [Type Conversion](#type-conversion)
   and knowledge of the function definition and create an `Object`
1. If `Array`: Parameters will be checked for type consistency in the order of
   the definition `params`
1. If `Object`: Parameters will be checked for type consistency based on names
   of the definition `params`
1. If any inconsistencies are found, cease execution and immediately return a
   `ParameterError`
1. If a parameter has no defaultValue specified and is not provided, immediately
   return a `ParameterError`
1. Try to execute the function, if the function fails to parse or is not valid,
   immediately return a `FatalError`
1. If a function hits a specified timeout (execution time limit), immediately
   return a `FatalError`
1. If a function returns an error (via callback) or one is thrown and not caught,
   immediately return a `RuntimeError`
1. If function returns inconsistent response (does not match `returns` type),
   immediately return a `ValueError`
1. If no errors are encountered, return the value to the client
1. If over HTTP and `content-type` is not being overloaded (i.e. developer
   specified through a vendor-specific mechanism), return `buffer` type data as
   `application/octet-stream` and any other values as `application/json`.

### Context

Every function intended to be consumed via FunctionScript has the option to specify
an *optional* magic `context` parameter that receives vendor-specific
information about the function execution context - for example, if consumed over
HTTP, header details. FunctionScript definitions must specify whether or not they
consume a `context` object. Context objects are extensible but **MUST** contain
the following fields;

| Field | Definition |
| ----- | ---------- |
| params | An `object` mapping called parameter names to their values |
| http | `null` if not accessed via http, otherwise an `object` |
| http.headers | If accessed via HTTP, an `object` containing header values |

### Errors

Errors returned by FunctionScript-compliant services must follow the following JSON
format:

```json
{
  "error": {
    "type": "ClientError",
    "message": "You know nothing, Jon Snow",
    "details": {}
  }
}
```

`details` is an optional object that can provide additional Parameter details.
Valid Error types are:

- `ClientError`
- `ParameterError`
- `FatalError`
- `RuntimeError`
- `ValueError`

#### ClientError

`ClientError`s are returned as a result of bad or malformed client data,
  including lack of authorization or a missing function (not found). If over
  HTTP, they **must** returns status codes in the range of `4xx`.

#### ParameterError

`ParameterError`s are a result of Parameters not passing type-safety checks,
  and **must** return status code `400` if over HTTP.

Parameter Errors **must** have the following format;

```json
{
  "error": {
    "type": "ParameterError",
    "message": "ParameterError",
    "details": {...}
  }
}
```

`"details"` should be an object mapping parameter names to their respective
validation (type-checking) errors. Currently, this specification defines
two classifications of a ParameterError for a parameter; *required* and
*invalid*. The format of `"details": {}` should follow this format;

##### Details: Required

```json
{
  "param_name": {
    "message": "((descriptive message stating parameter is required))",
    "required": true
  }
}
```

##### Details: Invalid

```json
{
  "param_name": {
    "message": "((descriptive message stating parameter is invalid))",
    "invalid": true,
    "expected": {
      "type": "number"
    },
    "actual": {
      "type": "string",
      "value": "hello world"
    }
  }
}
```

#### FatalError

`FatalError`s are a result of function mismanagement - either your function
  could not be loaded, executed, or it timed out. These **must** return status
  code `500` if over HTTP.

#### RuntimeError

`RuntimeError`s are a result of uncaught exceptions in your code as it runs,
  including errors you explicitly choose to throw (or send to clients via a
  callback, for example). These **must** return status code `403` if over
  HTTP.

#### ValueError

`ValueError`s are a result of your function returning an unexpected value
  based on FunctionScript type-safety mechanisms. These **must** return status code
  `502` if over HTTP.

`ValueError` looks like an *invalid* ParameterError, where the `details`
Object only ever contains a single key called `"returns"`. These are encountered
due to implementation issues on the part of the function developer.

```json
{
  "error": {
    "type": "ValueError",
    "message": "ValueError",
    "details": {
      "returns": {
        "message": "((descriptive message stating return value is invalid))",
        "invalid": true,
        "expected": {
          "type": "boolean"
        },
        "actual": {
          "type": "number",
          "value": 2017
        }
      }
    }
  }
}
```

# FunctionScript Server and Gateway: Implementation

A fully-compliant FunctionScript gateway (that just uses local function resources)
is available with this package, simply clone it and run `npm test` or look
at the `/tests` folder for more information.

The current FunctionScript specification is used in production by the FaaS
provider [Standard Library](https://stdlib.com), and is available for local use with the
[Standard Library CLI Package](https://github.com/stdlib/lib) which relies on this
repository as a dependency.

# Acknowledgements

FunctionScript is the result of years of concerted effort working to make API
development easier. It would not be possible without the personal and financial
investments of some very amazing people and companies.

## Corporate Interests

Via investments in Polybit Inc., parent of [Standard Library](https://stdlib.com),
the following companies have invested countless hours in and provided financial
support which has enabled the R&D that has made this project possible.

[Stripe](https://stripe.com), the global leader in online payments
[![Stripe Logo](/images/stripe-logo-300.png)](https://stripe.com)

[Slack](https://slack.com), the online platform for work and communication
[![Slack Logo](/images/slack-logo-300.png)](https://slack.com)

## Special Thanks

There have been a number of helpful supporters and contributors along the way,
and FunctionScript would not be possible without any of them.

### Core Contributors

- [**Keith Horwood**](https://twitter.com/keithwhor)
- [**Jacob Lee**](https://twitter.com/hacubu)
- [**Steve Meyer**](https://twitter.com/notoriaga)

### Friends and Supporters

- [**Chad Fowler**](https://twitter.com/chadfowler)
- [**Bear Douglas**](https://twitter.com/beardigsit)
- [**Romain Huet**](https://twitter.com/romainhuet)
- [**Will Gaybrick**](https://twitter.com/gaybrick)
- [**Patrick Collison**](https://twitter.com/patrickc)
- [**Patrick McKenzie**](https://twitter.com/patio11)
- [**David Singleton**](https://twitter.com/dps)

# Notes

The software contained within this repository has been developed and is
copyrighted by the [Standard Library](https://stdlib.com) Team at Polybit Inc. and is
MIT licensed.
