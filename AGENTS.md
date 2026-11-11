# Agent Instructions for Frigate NVR

This document provides coding guidelines and best practices for contributing to Frigate NVR, a complete and local NVR designed for Home Assistant with AI object detection.

## Project Overview

Frigate NVR is a realtime object detection system for IP cameras that uses:

- **Backend**: Python 3.13+ with FastAPI, OpenCV, TensorFlow/ONNX
- **Frontend**: Vue 3 with TypeScript, Vite and modern CSS
- **Architecture**: Multiprocessing design with ZMQ and MQTT communication
- **Focus**: Minimal resource usage with maximum performance

## Code Review Guidelines

When reviewing code, do NOT comment on:

- Missing imports - Static analysis tooling catches these
- Code formatting - Ruff (Python) and Prettier (TypeScript/Vue) handle formatting
- Minor style inconsistencies already enforced by linters

## Python Backend Standards

### Python Requirements

- **Compatibility**: Python 3.13+
- **Language Features**: Use modern Python features:
  - Pattern matching
  - Type hints (comprehensive typing preferred)
  - f-strings (preferred over `%` or `.format()`)
  - Dataclasses
  - Async/await patterns

### Code Quality Standards

- **Formatting**: Ruff (configured in `pyproject.toml`)
- **Linting**: Ruff with rules defined in project config
- **Type Checking**: Use type hints consistently
- **Testing**: unittest framework - use `python3 -u -m frigate.test` to run the suite in parallel groups
- **Language**: American English for all code, comments, and documentation
- **Punctuation**: Do not use em dashes in documentation, comments, or strings; reword with standard punctuation (commas, colons, parentheses, or separate sentences)

### Logging Standards

- **Logger Pattern**: Use module-level logger

  ```python
  import logging

  logger = logging.getLogger(__name__)
  ```

- **Format Guidelines**:
  - No periods at end of log messages
  - No sensitive data (keys, tokens, passwords)
  - Use lazy logging: `logger.debug("Message with %s", variable)`
- **Log Levels**:
  - `debug`: Development and troubleshooting information
  - `info`: Important runtime events (startup, shutdown, state changes)
  - `warning`: Recoverable issues that should be addressed
  - `error`: Errors that affect functionality but don't crash the app
  - `exception`: Use in except blocks to include traceback

### Error Handling

- **Exception Types**: Choose most specific exception available
- **Try/Catch Best Practices**:
  - Only wrap code that can throw exceptions
  - Keep try blocks minimal - process data after the try/except
  - Avoid bare exceptions except in background tasks

  Bad pattern:

  ```python
  try:
      data = await device.get_data()  # Can throw
      # ❌ Don't process data inside try block
      processed = data.get("value", 0) * 100
      result = processed
  except DeviceError:
      logger.error("Failed to get data")
  ```

  Good pattern:

  ```python
  try:
      data = await device.get_data()  # Can throw
  except DeviceError:
      logger.error("Failed to get data")
      return

  # ✅ Process data outside try block
  processed = data.get("value", 0) * 100
  result = processed
  ```

### Async Programming

- **External I/O**: All external I/O operations must be async
- **Best Practices**:
  - Avoid sleeping in loops - use `asyncio.sleep()` not `time.sleep()`
  - Avoid awaiting in loops - use `asyncio.gather()` instead
  - No blocking calls in async functions
  - Use `asyncio.create_task()` for background operations
- **Thread Safety**: Use proper synchronization for shared state

### Documentation Standards

- **Module Docstrings**: Concise descriptions at top of files
  ```python
  """Utilities for motion detection and analysis."""
  ```
- **Function Docstrings**: Required for public functions and methods

  ```python
  async def process_frame(frame: ndarray, config: Config) -> Detection:
      """Process a video frame for object detection.

      Args:
          frame: The video frame as numpy array
          config: Detection configuration

      Returns:
          Detection results with bounding boxes
      """
  ```

- **Comment Style**:
  - Explain the "why" not just the "what"
  - Keep lines under 88 characters when possible
  - Use clear, descriptive comments

### File Organization

- **API Endpoints**: `frigate/api/` - FastAPI route handlers
- **Configuration**: `frigate/config/` - Configuration parsing and validation
- **Detectors**: `frigate/detectors/` - Object detection backends
- **Events**: `frigate/events/` - Event management and storage
- **Utilities**: `frigate/util/` - Shared utility functions

## Frontend (Vue/TypeScript) Standards

The frontend in `web/` is Vue 3 (`<script setup lang="ts">`), Vite and plain
modern CSS. There is no CSS framework and no UI kit.

### Internationalization (i18n)

- **CRITICAL**: Never write user-facing strings directly in components
- **Always use the `useT()` composable** (i18next under the hood, reusing the existing locale files)

  ```vue
  <script setup lang="ts">
  import { useT } from "@/composables/useT";

  const { t } = useT(["views/app"]);
  </script>

  <template>
    <p>{{ t("camera.notFound") }}</p>
  </template>
  ```

- **Translation Files**: Add English strings to `web/public/locales/en`. Strings for the core screens live in `views/app.json`
- **Other namespaces**: Prefix the key, eg `t("objects:person")` or `t("views/events:alerts")`
- **Check**: `npm run i18n:check` fails when a key used in `src` is missing from the English files

### Styling

- **Scoped CSS** in every component (`<style scoped>`), using native nesting
- **Design tokens only**: colors, radii, shadows and type sizes come from `web/src/styles/tokens.css`. Never put raw hex or rgb values in a `.vue` file; add a token instead
- **Modern CSS is preferred over JavaScript**: container queries, `:has()`, `aspect-ratio`, `color-mix()`, the Popover API and `@starting-style`
- **`:deep()` must not be nested** inside another rule. Vue's scoped compiler mistranslates nested `:deep()`, so write it as a flat rule such as `.parent :deep(svg) {}`

### Component Patterns

- **Reusable components**: `web/src/components/{ui,layout,camera,player,timeline,review}`
- **Views**: `web/src/views/` are route components that compose those pieces
- **State**: Vue reactivity and composables in `web/src/composables/`
- **Data fetching**: `useQuery()` from `web/src/api/query.ts`. It keeps the previous data while a key changes, so views never blank
- **Websocket**: `useWsTopic()` and `onWsMessage()` from `web/src/api/ws.ts`
- **Media**: player logic lives in framework-free modules in `web/src/players/`. Components lease live sessions from the pool (`players/pool.ts`) and never create players directly

### Code Quality

- **Linting**: ESLint with `eslint-plugin-vue` and `typescript-eslint` (see `web/eslint.config.js`)
- **Type checking**: `vue-tsc --noEmit`, strict mode
- **Formatting**: Prettier
- **Rules**: `no-console` is an error. Unused variables must be prefixed with `_`. Avoid `any`

### File Organization

- **Views**: `web/src/views/`: route components
- **Components**: `web/src/components/`: reusable components
- **Composables**: `web/src/composables/`: shared reactive logic
- **Players**: `web/src/players/`: live and recorded playback, framework free
- **API**: `web/src/api/`: http, query cache and websocket
- **Types**: `web/src/types/`: TypeScript type definitions
- **Roadmap**: `web/TODO.md` tracks the rebuild and the pages still to port

## Testing Requirements

### Backend Testing

- **Framework**: Python unittest
- **Run Command**: `python3 -u -m frigate.test` (parallel groups; plain `python3 -u -m unittest` runs serially)
- **Location**: `frigate/test/`
- **Coverage**: Aim for comprehensive test coverage of core functionality
- **Pattern**: Use `TestCase` classes with descriptive test method names
  ```python
  class TestMotionDetection(unittest.TestCase):
      def test_detects_motion_above_threshold(self):
          # Test implementation
  ```

### Test Best Practices

- Always have a way to test your work and confirm your changes
- Write tests for bug fixes to prevent regressions
- Test edge cases and error conditions
- Mock external dependencies (cameras, APIs, hardware)
- Use fixtures for test data

## Development Commands

### Python Backend

```bash
# Run all tests in parallel groups (-j to set the number of jobs)
python3 -u -m frigate.test

# Run specific test file
python3 -u -m unittest frigate.test.test_ffmpeg_presets

# Check formatting (Ruff)
ruff format --check frigate/

# Apply formatting
ruff format frigate/

# Run linter
ruff check frigate/

# Type check
python3 -u -m mypy --config-file frigate/mypy.ini frigate

# Regenerate the OpenAPI spec after adding, changing, or removing an API
# endpoint or its auth dependency — outputs docs/static/frigate-api.yaml,
# annotated with each endpoint's auth requirement (admin / any / camera /
# public). NEVER edit that file by hand. CI runs the --check variant and fails
# if it is out of date. (from repo root)
python3 generate_api_auth_spec.py
python3 generate_api_auth_spec.py --check
```

### Frontend (from web/ directory)

```bash
# Start dev server (AI agents should never run this directly unless asked)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run prettier:write

# E2E: first-time setup
npm install
npx playwright install chromium

# E2E: build the app and run all tests
npm run e2e:build && npm run e2e

# E2E: interactive UI for debugging
npm run e2e:ui

# E2E: run a specific spec
npx playwright test --config e2e/playwright.config.ts e2e/specs/camera.spec.ts

# E2E: filter by name, or run only desktop/mobile
npx playwright test --config e2e/playwright.config.ts --grep="seamless"
npx playwright test --config e2e/playwright.config.ts --project=desktop

# E2E: regenerate mock data after backend model changes (from repo root)
PYTHONPATH=. python3 web/e2e/fixtures/mock-data/generate-mock-data.py

# Regenerate config translations from Pydantic models — outputs to
# web/public/locales/en/config/{global,cameras}.json. NEVER edit those
# JSON files by hand; change the Pydantic field title/description and
# re-run this script. (from repo root)
python3 generate_config_translations.py

# Verify every t() key used in src exists in the English locale files
npm run i18n:check

# Type check and unit tests
npm run typecheck
npm run test:run
```

### Docker Development

AI agents should never run these commands directly unless instructed.

```bash
# Build local image
make local

# Build debug image
make debug
```

## Common Patterns

### API Endpoint Pattern

```python
from fastapi import APIRouter, Request
from frigate.api.defs.tags import Tags

router = APIRouter(tags=[Tags.Events])

@router.get("/events")
async def get_events(request: Request, limit: int = 100):
    """Retrieve events from the database."""
    # Implementation
```

After adding, changing, or removing an endpoint (or its auth dependency), regenerate the OpenAPI spec with `python3 generate_api_auth_spec.py` so `docs/static/frigate-api.yaml` stays in sync and the endpoint's auth requirement is documented. CI enforces this via the `--check` variant; never edit that file by hand.

### Configuration Access

```python
# Access Frigate configuration
config: FrigateConfig = request.app.frigate_config
camera_config = config.cameras["front_door"]
```

### Database Queries

```python
from frigate.models import Event

# Use Peewee ORM for database access
events = (
    Event.select()
    .where(Event.camera == camera_name)
    .order_by(Event.start_time.desc())
    .limit(limit)
)
```

## Common Anti-Patterns to Avoid

### ❌ Avoid These

```python
# Blocking operations in async functions
data = requests.get(url)  # ❌ Use async HTTP client
time.sleep(5)  # ❌ Use asyncio.sleep()

# Hardcoded strings in Vue templates
<p>Camera not found</p>  # ❌ Use t("camera.notFound")

# Missing error handling
data = await api.get_data()  # ❌ No exception handling

# Bare exceptions in regular code
try:
    value = await sensor.read()
except Exception:  # ❌ Too broad
    logger.error("Failed")

# Returning exceptions in JSON responses
except ValueError as e:
    return JSONResponse(
        content={"success": False, "message": str(e)},
    )
```

### ✅ Use These Instead

```python
# Async operations
import aiohttp
async with aiohttp.ClientSession() as session:
    async with session.get(url) as response:
        data = await response.json()

await asyncio.sleep(5)  # ✅ Non-blocking

# Translatable strings in Vue
const { t } = useT(["views/app"]);
<p>{{ t("camera.notFound") }}</p>  # ✅ Translatable

# Proper error handling
try:
    data = await api.get_data()
except ApiException as err:
    logger.error("API error: %s", err)
    raise

# Specific exceptions
try:
    value = await sensor.read()
except SensorException as err:  # ✅ Specific
    logger.exception("Failed to read sensor")

# Safe error responses
except ValueError:
    logger.exception("Invalid parameters for API request")
    return JSONResponse(
        content={
            "success": False,
            "message": "Invalid request parameters",
        },
    )
```

## WebSocket Broadcasts

Outbound WebSocket broadcasts go through a per-recipient classifier in `frigate/comms/ws.py` that enforces camera-level access. **The classifier is fail-closed: any topic it doesn't recognize is dropped for every client.** New outbound topics must be classified there or they'll silently disappear.

## Project-Specific Conventions

### Configuration Files

- Main config: `config/config.yml`

### Directory Structure

- Backend code: `frigate/`
- Frontend code: `web/`
- Docker files: `docker/`
- Documentation: `docs/`
- Database migrations: `migrations/`

### Code Style Conformance

Always conform new and refactored code to the existing coding style in the project:

- Follow established patterns in similar files
- Match indentation and formatting of surrounding code
- Use consistent naming conventions (snake_case for Python, camelCase for TypeScript)
- Maintain the same level of verbosity in comments and docstrings

## Additional Resources

- Documentation: https://docs.frigate.video
- Main Repository: https://github.com/blakeblackshear/frigate
- Home Assistant Integration: https://github.com/blakeblackshear/frigate-hass-integration
