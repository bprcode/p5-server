class SpecificError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    this.code = 500
  }
}

class NotFoundError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 404
  }
}

class PermissionError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 403
  }
}

class RequestError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 400
  }
}

class ValidationError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 422
  }
}

class ConflictError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 409
  }
}

class InternalError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 500
  }
}

class TeapotError extends SpecificError {
  constructor(message) {
    super(message)
    this.code = 418
  }
}

module.exports = {
  SpecificError,
  NotFoundError,
  PermissionError,
  RequestError,
  ConflictError,
  ValidationError,
  InternalError,
  TeapotError,
}
