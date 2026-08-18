'use strict';

/**
 * VaultFlow authorization contract helpers.
 *
 * The invariant is simple and intentionally centralized:
 *   an authenticated user's id MUST be part of every resource lookup.
 *
 * This helper is model-agnostic so new domains can reuse the same contract
 * without inventing a different ownership check.
 */

function authorizationError(message = 'Resource not found') {
  const error = new Error(message);
  error.statusCode = 404;
  error.code = 'RESOURCE_NOT_FOUND';
  return error;
}

function isValidObjectId(Model, value) {
  // Mongoose models expose the Types namespace. Keeping validation here avoids
  // turning malformed IDs into 500 responses from CastError.
  return Boolean(Model?.base?.Types?.ObjectId?.isValid(value));
}

async function assertOwnedResource(Model, userId, resourceId, options = {}) {
  const {
    select = '_id',
    session = null,
    notFoundMessage = 'Resource not found',
    extraFilter = {}
  } = options;

  if (!userId || !resourceId || !isValidObjectId(Model, resourceId)) {
    throw authorizationError(notFoundMessage);
  }

  const filter = {
    ...extraFilter,
    _id: resourceId,
    userId
  };

  const query = Model.findOne(filter).select(select);
  if (session) query.session(session);

  const resource = await query.lean();
  if (!resource) throw authorizationError(notFoundMessage);
  return resource;
}

module.exports = {
  assertOwnedResource,
  authorizationError
};
