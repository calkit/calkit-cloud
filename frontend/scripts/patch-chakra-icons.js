#!/usr/bin/env node
/**
 * Patch @chakra-ui/icons to use React.forwardRef instead of importing from @chakra-ui/react
 * This is needed because @chakra-ui/react v3 doesn't re-export forwardRef
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const spinnerFile = path.join(__dirname, '../node_modules/@chakra-ui/icons/dist/esm/Spinner.mjs')

if (fs.existsSync(spinnerFile)) {
  let content = fs.readFileSync(spinnerFile, 'utf8')

  // Replace the import to get forwardRef from react instead of @chakra-ui/react
  const updated = content.replace(
    "import { forwardRef, Icon } from '@chakra-ui/react';",
    "import { Icon } from '@chakra-ui/react';\nimport { forwardRef } from 'react';"
  )

  if (updated !== content) {
    fs.writeFileSync(spinnerFile, updated, 'utf8')
    console.log('✓ Patched @chakra-ui/icons Spinner.mjs')
  }
} else {
  console.log('⚠ Spinner.mjs not found, skipping patch')
}
