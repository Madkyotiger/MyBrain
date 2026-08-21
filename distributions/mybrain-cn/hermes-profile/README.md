# @MyBrain Hermes Profile

This public package contains only generic configuration, a SOUL, and the eight @MyBrain entry skills. It contains no user memories, sessions, credentials, or machine-specific paths.

Install from this directory:

```bash
hermes profile install /path/to/distributions/mybrain-cn/hermes-profile --name mybrain-cn -y
```

Before running the profile, set `MYBRAIN_GBRAIN_CLI`, `MYBRAIN_GBRAIN_HOME`, and `MYBRAIN_SOURCE_ID` from the private onboarding result. The first two must be absolute paths. Model-provider credentials belong in the installed profile's private `.env` or Hermes credential setup, never in this package.
