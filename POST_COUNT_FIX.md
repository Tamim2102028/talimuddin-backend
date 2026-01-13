# Post Count Double Increment Fix

## Problem

Post create korar somoy `postsCount` double hoye jacchilo karon increment logic **dui jaygay** chilo:

1. **Controller Layer** (`post.controllers.js`) - Manual increment
2. **Service Layer** (`post.service.js`) - Automatic increment

Ebong Room service e o duplicate increment chilo.

## Root Cause

```javascript
// ❌ BEFORE: Controller e manual increment
case POST_TARGET_MODELS.USER: {
  result = await createPostService(req.body, userId);

  // Duplicate increment!
  await User.findByIdAndUpdate(postOnId, {
    $inc: { postsCount: 1 },
  });
  break;
}
```

```javascript
// ❌ BEFORE: Service e o increment
// post.service.js
if (initialStatus === POST_STATUS.APPROVED) {
  if (postOnModel === POST_TARGET_MODELS.USER) {
    // Duplicate increment!
    await User.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  }
}
```

## Solution

Controller theke manual increment logic remove korechi. Service layer e already properly handle kora ache.

### Files Modified

#### 1. `controllers/common/post.controllers.js` ✅ FIXED

**Removed duplicate increment from all cases:**

- `POST_TARGET_MODELS.USER` - Removed manual User.findByIdAndUpdate
- `POST_TARGET_MODELS.GROUP` - Removed manual Group.findByIdAndUpdate
- `POST_TARGET_MODELS.DEPARTMENT` - Removed manual Department.findByIdAndUpdate
- `POST_TARGET_MODELS.INSTITUTION` - Removed manual Institution.findByIdAndUpdate
- `POST_TARGET_MODELS.ROOM` - Already clean

**After:**

```javascript
case POST_TARGET_MODELS.USER: {
  // 1. Validation
  if (postOnId.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only post on your own profile");
  }

  // 2. Create Post (service handles postsCount increment)
  result = await createPostService(req.body, userId);
  break;
}
```

#### 2. `services/room.service.js` ✅ FIXED

**Removed duplicate increment:**

```javascript
// ❌ BEFORE
const formattedPost = await createPostService(newPostData, userId);
await Room.findByIdAndUpdate(roomId, { $inc: { postsCount: 1 } }); // Duplicate!

// ✅ AFTER
const formattedPost = await createPostService(newPostData, userId);
// Service already handles increment
```

## How It Works Now

### Single Source of Truth: `post.service.js`

```javascript
// services/common/post.service.js - Line 127-141
if (initialStatus === POST_STATUS.APPROVED) {
  if (postOnModel === POST_TARGET_MODELS.GROUP) {
    await Group.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  } else if (postOnModel === POST_TARGET_MODELS.USER) {
    await User.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  } else if (postOnModel === POST_TARGET_MODELS.DEPARTMENT) {
    await Department.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  } else if (postOnModel === POST_TARGET_MODELS.INSTITUTION) {
    await Institution.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  } else if (postOnModel === POST_TARGET_MODELS.ROOM) {
    await Room.findByIdAndUpdate(postOnId, { $inc: { postsCount: 1 } });
  }
}
```

### Flow

1. Controller validates request
2. Controller calls `createPostService()`
3. Service creates post
4. Service increments `postsCount` (ONLY if status is APPROVED)
5. Service returns formatted post
6. Controller returns response

## Benefits

✅ No more double counting
✅ Single source of truth for count logic
✅ Cleaner controller code
✅ Proper separation of concerns
✅ Consistent behavior across all post types

## Testing Checklist

- [ ] Create post on User profile - count should increment by 1
- [ ] Create post in Room - count should increment by 1
- [ ] Create post in Group - count should increment by 1
- [ ] Create draft post - count should NOT increment
- [ ] Delete post - count should decrement by 1

---

**Fixed:** January 13, 2026
**Status:** ✅ Complete
