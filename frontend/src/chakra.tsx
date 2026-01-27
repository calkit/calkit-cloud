/**
 * Chakra UI v3 Adapter - Maps v2 APIs to v3 namespaced components
 * This provides a compatibility layer for gradual migration to v3 idioms
 */

import React from "react"
import * as ChakraV3 from "@chakra-ui/react"

// Re-export all v3 components and hooks directly
export * from "@chakra-ui/react"

// ============================================================================
// FORM COMPONENTS ADAPTER
// ============================================================================

/**
 * FormControl v2 -> Field.Root v3 adapter
 * Maps v2 FormControl props to v3 Field.Root
 */
export const FormControl = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Field.Root> & {
    isRequired?: boolean
    isInvalid?: boolean
    isDisabled?: boolean
    isReadOnly?: boolean
  }
>(
  (
    {
      isRequired,
      isInvalid,
      isDisabled,
      isReadOnly,
      required,
      invalid,
      disabled,
      readOnly,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.Field.Root
      ref={ref}
      required={isRequired ?? required}
      invalid={isInvalid ?? invalid}
      disabled={isDisabled ?? disabled}
      readOnly={isReadOnly ?? readOnly}
      {...props}
    />
  ),
)
FormControl.displayName = "FormControl"

/**
 * FormLabel v2 -> Field.Label v3 adapter
 */
export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Field.Label>
>(({ ...props }, ref) => <ChakraV3.Field.Label ref={ref} {...props} />)
FormLabel.displayName = "FormLabel"

/**
 * FormErrorMessage v2 -> Field.ErrorText v3 adapter
 */
export const FormErrorMessage = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Field.ErrorText>
>(({ ...props }, ref) => <ChakraV3.Field.ErrorText ref={ref} {...props} />)
FormErrorMessage.displayName = "FormErrorMessage"

/**
 * FormHelperText v2 -> Field.HelperText v3 adapter
 */
export const FormHelperText = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Field.HelperText>
>(({ ...props }, ref) => <ChakraV3.Field.HelperText ref={ref} {...props} />)
FormHelperText.displayName = "FormHelperText"

// ============================================================================
// MODAL COMPONENTS ADAPTER
// ============================================================================

/**
 * Modal v2 -> Dialog.Root v3 adapter
 * Maps useDisclosure hook properties to Dialog open/onOpenChange
 */
interface ModalProps {
  isOpen?: boolean
  onClose?: () => void
  isCentered?: boolean
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  blockScrollOnMount?: boolean
  children?: React.ReactNode
  size?: string
  [key: string]: any
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen = false,
      onClose,
      isCentered,
      closeOnOverlayClick = true,
      closeOnEsc = true,
      blockScrollOnMount = true,
      children,
      ...props
    },
    _ref, // Dialog.Root doesn't accept ref in v3
  ) => {
    const handleOpenChange = (e: any) => {
      if (!e.open) {
        onClose?.()
      }
    }

    // @ts-ignore - v3 Dialog.Root has different prop types than v2 Modal
    return (
      <ChakraV3.Dialog.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        placement={isCentered ? "center" : "center"}
        closeOnInteractOutside={closeOnOverlayClick}
        closeOnEscape={closeOnEsc}
        preventScroll={blockScrollOnMount}
        {...props}
      >
        {children}
      </ChakraV3.Dialog.Root>
    )
  },
)
Modal.displayName = "Modal"

/**
 * ModalOverlay v2 -> Dialog.Backdrop v3 adapter
 */
export const ModalOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.Backdrop>
>(({ ...props }, ref) => <ChakraV3.Dialog.Backdrop ref={ref} {...props} />)
ModalOverlay.displayName = "ModalOverlay"

/**
 * ModalContent v2 -> Dialog wrapper v3 adapter
 */
export const ModalContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.Content> & {
    as?: any
  }
>(({ as, ...props }, ref) => (
  <ChakraV3.Dialog.Positioner>
    <ChakraV3.Dialog.Content ref={ref} {...props} />
  </ChakraV3.Dialog.Positioner>
))
ModalContent.displayName = "ModalContent"

/**
 * ModalHeader v2 -> Dialog.Header v3 adapter
 */
export const ModalHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.Header>
>(({ ...props }, ref) => <ChakraV3.Dialog.Header ref={ref} {...props} />)
ModalHeader.displayName = "ModalHeader"

/**
 * ModalBody v2 -> Dialog.Body v3 adapter
 */
export const ModalBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.Body>
>(({ ...props }, ref) => <ChakraV3.Dialog.Body ref={ref} {...props} />)
ModalBody.displayName = "ModalBody"

/**
 * ModalFooter v2 -> Dialog.Footer v3 adapter
 */
export const ModalFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.Footer>
>(({ ...props }, ref) => <ChakraV3.Dialog.Footer ref={ref} {...props} />)
ModalFooter.displayName = "ModalFooter"

/**
 * ModalCloseButton v2 -> Dialog.CloseTrigger v3 adapter
 */
export const ModalCloseButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Dialog.CloseTrigger>
>(({ ...props }, ref) => <ChakraV3.Dialog.CloseTrigger ref={ref} {...props} />)
ModalCloseButton.displayName = "ModalCloseButton"

// ============================================================================
// SELECT COMPONENTS ADAPTER
// ============================================================================

/**
 * Select v2 -> NativeSelect v3 adapter
 * Maps v2 Select to v3 NativeSelect.Root with Field
 */
export const Select = React.forwardRef<HTMLSelectElement, any>(
  (
    {
      isDisabled,
      isInvalid,
      placeholder,
      disabled,
      invalid,
      defaultValue,
      children,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.NativeSelect.Root disabled={isDisabled ?? disabled}>
      <ChakraV3.NativeSelect.Field
        ref={ref as any}
        placeholder={placeholder}
        defaultValue={defaultValue}
        {...props}
      >
        {children}
      </ChakraV3.NativeSelect.Field>
    </ChakraV3.NativeSelect.Root>
  ),
)
Select.displayName = "Select"

// ============================================================================
// DRAWER COMPONENTS ADAPTER (similar to Modal)
// ============================================================================

interface DrawerProps {
  isOpen?: boolean
  onClose?: () => void
  children?: React.ReactNode
  placement?: "left" | "right" | "top" | "bottom"
  blockScrollOnMount?: boolean
  closeOnEsc?: boolean
  closeOnOverlayClick?: boolean
  [key: string]: any
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      isOpen = false,
      onClose,
      placement = "right",
      blockScrollOnMount = true,
      closeOnEsc = true,
      closeOnOverlayClick = true,
      children,
      ...props
    },
    _ref, // Drawer.Root doesn't accept ref in v3
  ) => {
    const handleOpenChange = (e: any) => {
      if (!e.open) {
        onClose?.()
      }
    }

    // @ts-ignore - v3 Drawer.Root has different prop types than v2 Drawer
    return (
      <ChakraV3.Drawer.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        placement={placement}
        preventScroll={blockScrollOnMount}
        closeOnEscape={closeOnEsc}
        closeOnInteractOutside={closeOnOverlayClick}
        {...props}
      >
        {children}
      </ChakraV3.Drawer.Root>
    )
  },
)
Drawer.displayName = "Drawer"

export const DrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.Backdrop>
>(({ ...props }, ref) => <ChakraV3.Drawer.Backdrop ref={ref} {...props} />)
DrawerOverlay.displayName = "DrawerOverlay"

export const DrawerContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.Content>
>(({ ...props }, ref) => (
  <ChakraV3.Drawer.Positioner>
    <ChakraV3.Drawer.Content ref={ref} {...props} />
  </ChakraV3.Drawer.Positioner>
))
DrawerContent.displayName = "DrawerContent"

export const DrawerHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.Header>
>(({ ...props }, ref) => <ChakraV3.Drawer.Header ref={ref} {...props} />)
DrawerHeader.displayName = "DrawerHeader"

export const DrawerBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.Body>
>(({ ...props }, ref) => <ChakraV3.Drawer.Body ref={ref} {...props} />)
DrawerBody.displayName = "DrawerBody"

export const DrawerFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.Footer>
>(({ ...props }, ref) => <ChakraV3.Drawer.Footer ref={ref} {...props} />)
DrawerFooter.displayName = "DrawerFooter"

export const DrawerCloseButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Drawer.CloseTrigger>
>(({ ...props }, ref) => <ChakraV3.Drawer.CloseTrigger ref={ref} {...props} />)
DrawerCloseButton.displayName = "DrawerCloseButton"

// ============================================================================
// BUTTON PROP ADAPTER
// ============================================================================

/**
 * Button v2 -> Button v3 adapter
 * Maps v2 button props (isDisabled, isLoading, colorScheme) to v3
 * Also maps v2 button variants to v3
 */
export const Button = React.forwardRef<HTMLButtonElement, any>(
  (
    {
      isDisabled,
      isLoading,
      isActive,
      colorScheme,
      leftIcon,
      rightIcon,
      disabled,
      loading,
      colorPalette,
      variant: variantProp,
      children,
      ...props
    },
    ref,
  ) => {
    // Map v2 button variants to v3
    let variant = variantProp
    if (variant === "primary") {
      variant = "solid"
    } else if (variant === "ghost") {
      variant = "plain"
    } else if (variant === "danger") {
      variant = "solid" // danger buttons are solid with red colorPalette
    }

    return (
      <ChakraV3.Button
        ref={ref as any}
        disabled={isDisabled ?? disabled}
        loading={isLoading ?? loading}
        colorPalette={
          variant === "danger" && !colorScheme
            ? "red"
            : colorScheme ?? colorPalette
        }
        variant={variant}
        data-active={isActive ? "" : undefined}
        {...(leftIcon && { leftIcon })}
        {...(rightIcon && { rightIcon })}
        {...props}
      >
        {children}
      </ChakraV3.Button>
    )
  },
)
Button.displayName = "Button"

// ============================================================================
// INPUT PROP ADAPTER
// ============================================================================

/**
 * Input v2 -> Input v3 adapter
 * Maps v2 input props to v3 (isDisabled, isInvalid, isReadOnly, isRequired)
 */
export const Input = React.forwardRef<HTMLInputElement, any>(
  (
    {
      isDisabled,
      isInvalid,
      isReadOnly,
      isRequired,
      focusBorderColor,
      errorBorderColor,
      disabled,
      invalid,
      readOnly,
      required,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.Input
      ref={ref as any}
      disabled={isDisabled ?? disabled}
      readOnly={isReadOnly ?? readOnly}
      required={isRequired ?? required}
      {...props}
    />
  ),
)
Input.displayName = "Input"

// ============================================================================
// LINK PROP ADAPTER
// ============================================================================

/**
 * Link v2 -> Link v3 adapter
 * Maps v2 isExternal to v3 target/rel
 * Also supports Next.js/Router Link via `as` prop
 */
export const Link = React.forwardRef<HTMLAnchorElement, any>(
  (
    {
      isExternal,
      target: targetProp,
      rel: relProp,
      as: asProp,
      to,
      href,
      variant: variantProp,
      children,
      ...props
    },
    ref,
  ) => {
    const target = isExternal ? "_blank" : targetProp
    const rel = isExternal ? "noopener noreferrer" : relProp
    // Map v2 Link variants to v3
    const variant =
      variantProp === "blue" || variantProp === "default"
        ? "plain"
        : variantProp

    // If using 'as' prop (e.g., Next.js Link, Router Link), render that component directly
    // with Chakra's link styling applied via className/style
    if (asProp) {
      const Component = asProp
      return (
        <Component
          ref={ref}
          to={to ?? href}
          target={target}
          rel={rel}
          {...props}
        >
          {children}
        </Component>
      )
    }

    return (
      <ChakraV3.Link
        ref={ref as any}
        target={target}
        rel={rel}
        variant={variant}
        href={to ?? href}
        {...props}
      >
        {children}
      </ChakraV3.Link>
    )
  },
)
Link.displayName = "Link"

// ============================================================================
// CHECKBOX ADAPTER
// ============================================================================

/**
 * Checkbox v2 -> Checkbox.Root v3 adapter
 */
export const Checkbox = React.forwardRef<HTMLInputElement, any>(
  (
    {
      isChecked,
      isDisabled,
      isInvalid,
      isIndeterminate,
      colorScheme,
      checked,
      disabled,
      invalid,
      indeterminate,
      colorPalette,
      children,
      ...props
    },
    // ref is passed through but wrapped components may not accept it
    _ref,
  ) => (
    <ChakraV3.Checkbox.Root
      checked={isChecked ?? checked}
      disabled={isDisabled ?? disabled}
      invalid={isInvalid ?? invalid}
      colorPalette={colorScheme ?? colorPalette}
      {...props}
    >
      <ChakraV3.Checkbox.HiddenInput />
      <ChakraV3.Checkbox.Control>
        <ChakraV3.Checkbox.Indicator
          indeterminate={isIndeterminate ?? indeterminate}
        />
      </ChakraV3.Checkbox.Control>
      {children && (
        <ChakraV3.Checkbox.Label>{children}</ChakraV3.Checkbox.Label>
      )}
    </ChakraV3.Checkbox.Root>
  ),
)
Checkbox.displayName = "Checkbox"

// ============================================================================
// TEXT COMPONENT ADAPTER
// ============================================================================

/**
 * Text v2 -> Text v3 adapter
 * Maps v2 props (isTruncated, align) to v3 props (truncate, textAlign)
 */
export const Text = React.forwardRef<HTMLParagraphElement, any>(
  (
    {
      isTruncated,
      noOfLines,
      align,
      truncate: truncateProp,
      lineClamp: lcProp,
      textAlign: taaProp,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.Text
      ref={ref as any}
      truncate={isTruncated ?? truncateProp}
      lineClamp={noOfLines ?? lcProp}
      textAlign={align ?? taaProp}
      {...props}
    />
  ),
)
Text.displayName = "Text"

/**
 * Heading v2 -> Heading v3 adapter
 * Maps v2 props to v3
 */
export const Heading = React.forwardRef<HTMLHeadingElement, any>(
  ({ align, textAlign: taaProp, ...props }, ref) => (
    <ChakraV3.Heading
      ref={ref as any}
      textAlign={align ?? taaProp}
      {...props}
    />
  ),
)
Heading.displayName = "Heading"

// ============================================================================
// TOOLTIP COMPONENT ADAPTER
// ============================================================================

/**
 * Tooltip v2 -> Tooltip.Root v3 adapter
 * Maps v2 tooltip props to v3 positioning structure
 */
export const Tooltip = React.forwardRef<HTMLDivElement, any>(
  (
    {
      label,
      placement = "bottom",
      hasArrow,
      closeOnEsc,
      closeOnMouseDown,
      closeOnPointerDown: copProp,
      closeOnEscape: coeProp,
      children,
      positioning: positioningProp,
      ...props
    },
    // ref is not used for Tooltip
    _ref,
  ) => (
    <ChakraV3.Tooltip.Root
      positioning={
        positioningProp ?? {
          placement: placement as any,
        }
      }
      closeOnEscape={closeOnEsc ?? coeProp}
      closeOnPointerDown={closeOnMouseDown ?? copProp}
      {...props}
    >
      <ChakraV3.Tooltip.Trigger asChild>{children}</ChakraV3.Tooltip.Trigger>
      <ChakraV3.Tooltip.Positioner>
        <ChakraV3.Tooltip.Content>
          {hasArrow && <ChakraV3.Tooltip.Arrow />}
          {label}
        </ChakraV3.Tooltip.Content>
      </ChakraV3.Tooltip.Positioner>
    </ChakraV3.Tooltip.Root>
  ),
)
Tooltip.displayName = "Tooltip"

// ============================================================================
// ALERT ADAPTER
// ============================================================================

/**
 * Alert v2 -> Alert.Root v3 adapter
 */
export const Alert = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Alert.Root> & {
    status?: "success" | "error" | "warning" | "info"
  }
>(({ status, ...props }, ref) => (
  <ChakraV3.Alert.Root ref={ref} status={status} {...props} />
))
Alert.displayName = "Alert"

export const AlertIcon = React.forwardRef<
  SVGSVGElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Alert.Indicator>
>(({ ...props }, ref) => (
  <ChakraV3.Alert.Indicator ref={ref as any} {...props} />
))
AlertIcon.displayName = "AlertIcon"

export const AlertTitle = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Alert.Title>
>(({ ...props }, ref) => <ChakraV3.Alert.Title ref={ref} {...props} />)
AlertTitle.displayName = "AlertTitle"

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Alert.Description>
>(({ ...props }, ref) => <ChakraV3.Alert.Description ref={ref} {...props} />)
AlertDescription.displayName = "AlertDescription"

// ============================================================================
// SPINNER PROP ADAPTER
// ============================================================================

/**
 * Spinner v2 -> Spinner v3 adapter
 * Maps thickness -> borderWidth, speed -> animationDuration
 */
export const Spinner = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Spinner> & {
    thickness?: string
    speed?: string
  }
>(
  (
    {
      thickness,
      speed,
      borderWidth: bwProp,
      animationDuration: adProp,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.Spinner
      ref={ref}
      borderWidth={thickness ?? bwProp}
      animationDuration={speed ?? adProp}
      {...props}
    />
  ),
)
Spinner.displayName = "Spinner"

// ============================================================================
// TABLE COMPONENTS ADAPTER
// ============================================================================

/**
 * Table v2 -> Table.Root v3 adapter
 */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.Root>
>(({ ...props }, ref) => <ChakraV3.Table.Root ref={ref} {...props} />)
Table.displayName = "Table"

export const Thead = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.Header>
>(({ ...props }, ref) => <ChakraV3.Table.Header ref={ref} {...props} />)
Thead.displayName = "Thead"

export const Tbody = React.forwardRef<
  HTMLTableSectionElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.Body>
>(({ ...props }, ref) => <ChakraV3.Table.Body ref={ref} {...props} />)
Tbody.displayName = "Tbody"

export const Tr = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.Row>
>(({ ...props }, ref) => <ChakraV3.Table.Row ref={ref} {...props} />)
Tr.displayName = "Tr"

export const Th = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.ColumnHeader> & {
    isNumeric?: boolean
  }
>(({ isNumeric, textAlign: taaProp, ...props }, ref) => (
  <ChakraV3.Table.ColumnHeader
    ref={ref}
    textAlign={isNumeric ? "end" : taaProp}
    {...props}
  />
))
Th.displayName = "Th"

export const Td = React.forwardRef<
  HTMLTableCellElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Table.Cell> & {
    isNumeric?: boolean
  }
>(({ isNumeric, textAlign: taaProp, ...props }, ref) => (
  <ChakraV3.Table.Cell
    ref={ref}
    textAlign={isNumeric ? "end" : taaProp}
    {...props}
  />
))
Td.displayName = "Td"

// Aliases for v2 compat
export const TableContainer = ChakraV3.Table.ScrollArea
export const Tfoot = ChakraV3.Table.Footer
export const TableCaption = ChakraV3.Table.Caption

// ============================================================================
// TABS COMPONENTS ADAPTER
// ============================================================================

/**
 * Tabs v2 -> Tabs.Root v3 adapter
 * Maps v2 Tabs props (defaultIndex, index, onChange) to v3 (defaultValue, value, onValueChange)
 */
export const Tabs = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Tabs.Root> & {
    defaultIndex?: number
    index?: number
    onChange?: (index: number) => void
    isLazy?: boolean
  }
>(
  (
    {
      defaultIndex,
      index,
      onChange,
      isLazy,
      defaultValue: dv,
      value: v,
      onValueChange: ovc,
      lazyMount: lm,
      unmountOnExit: uoe,
      ...props
    },
    ref,
  ) => {
    const handleValueChange = (e: { value: string }) => {
      onChange?.(parseInt(e.value, 10))
    }

    return (
      <ChakraV3.Tabs.Root
        ref={ref}
        defaultValue={defaultIndex !== undefined ? String(defaultIndex) : dv}
        value={index !== undefined ? String(index) : v}
        onValueChange={onChange ? handleValueChange : ovc}
        lazyMount={isLazy ?? lm}
        unmountOnExit={isLazy ?? uoe}
        {...props}
      />
    )
  },
)
Tabs.displayName = "Tabs"

export const TabList = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Tabs.List>
>(({ ...props }, ref) => <ChakraV3.Tabs.List ref={ref} {...props} />)
TabList.displayName = "TabList"

export const TabPanels = React.forwardRef<
  HTMLDivElement,
  { children?: React.ReactNode }
>(({ children }, _ref) => <>{children}</>)
TabPanels.displayName = "TabPanels"

export const Tab = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Tabs.Trigger> & {
    children?: React.ReactNode
  }
>(({ children, value, ...props }, ref) => (
  <ChakraV3.Tabs.Trigger ref={ref} value={value ?? ""} {...props}>
    {children}
  </ChakraV3.Tabs.Trigger>
))
Tab.displayName = "Tab"

export const TabPanel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.Tabs.Content> & {
    children?: React.ReactNode
  }
>(({ children, value, ...props }, ref) => (
  <ChakraV3.Tabs.Content ref={ref} value={value ?? ""} {...props}>
    {children}
  </ChakraV3.Tabs.Content>
))
TabPanel.displayName = "TabPanel"

// ============================================================================
// RADIO GROUP ADAPTER
// ============================================================================

/**
 * RadioGroup v2 -> RadioGroup.Root v3 adapter
 */
export const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.RadioGroup.Root> & {
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
  }
>(({ value, defaultValue, onChange, onValueChange: ovc, ...props }, ref) => {
  return (
    <ChakraV3.RadioGroup.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onValueChange={
        onChange ? (details: any) => onChange?.(details.value) : (ovc as any)
      }
      {...props}
    />
  )
})
RadioGroup.displayName = "RadioGroup"

export const Radio = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof ChakraV3.RadioGroup.Item> & {
    value?: string
    colorScheme?: string
    children?: React.ReactNode
  }
>(({ value, colorScheme, colorPalette: cp, children, ...props }, ref) => (
  <ChakraV3.RadioGroup.Item
    ref={ref}
    value={value}
    colorPalette={colorScheme ?? cp}
    {...props}
  >
    <ChakraV3.RadioGroup.ItemHiddenInput />
    <ChakraV3.RadioGroup.ItemIndicator />
    {children && (
      <ChakraV3.RadioGroup.ItemText>{children}</ChakraV3.RadioGroup.ItemText>
    )}
  </ChakraV3.RadioGroup.Item>
))
Radio.displayName = "Radio"

// ============================================================================
// HOOK ADAPTERS
// ============================================================================

/**
 * useColorModeValue is removed in v3
 * For now, we'll create a stub that returns the light value
 * You should migrate to using CSS or next-themes instead
 */
export const useColorModeValue = (light: any, dark: any) => {
  // Check if dark mode is active by checking the document class
  const [colorMode, setColorMode] = React.useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light"
    }
    return "light"
  })

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setColorMode(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      )
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  return colorMode === "dark" ? dark : light
}

/**
 * useDisclosure hook v2 -> v3 adapter
 * v3 returns { open, onOpen, onClose, onToggle, setOpen }
 * v2 returns { isOpen, onOpen, onClose, isControlled }
 * Create a wrapper that maps the properties
 */
export const useDisclosureAdapter = () => {
  const disclosure = ChakraV3.useDisclosure()
  return {
    isOpen: disclosure.open,
    onOpen: disclosure.onOpen,
    onClose: disclosure.onClose,
    onToggle: disclosure.onToggle,
    isControlled: false,
    // Also include v3 properties for compatibility
    open: disclosure.open,
    setOpen: disclosure.setOpen,
  }
}

/**
 * Re-export useDisclosure but with compatibility
 * This will still return v3 format, but components can access .isOpen via translation
 */
export const useDisclosure = () => {
  const d = ChakraV3.useDisclosure()
  // Return object with both v2 and v3 properties
  return {
    isOpen: d.open, // v2 property
    open: d.open, // v3 property
    onOpen: d.onOpen,
    onClose: d.onClose,
    onToggle: d.onToggle,
    isControlled: false,
    setOpen: d.setOpen,
  } as any
}

// ============================================================================
// MENU COMPONENTS ADAPTER
// ============================================================================

/**
 * Menu v2 -> Menu.Root v3 adapter
 */
export const Menu = React.forwardRef<HTMLDivElement, any>(
  (
    { isLazy, lazyMount: lm, unmountOnExit: uoe, children, ...props },
    _ref, // Menu.Root doesn't accept ref in v3
  ) => (
    <ChakraV3.Menu.Root
      lazyMount={isLazy ?? lm}
      unmountOnExit={isLazy ?? uoe}
      {...props}
    >
      {children}
    </ChakraV3.Menu.Root>
  ),
)
Menu.displayName = "Menu"

export const MenuButton = React.forwardRef<HTMLButtonElement, any>(
  ({ children, isActive, data_active, ...props }, ref) => (
    <ChakraV3.Menu.Trigger asChild>
      <ChakraV3.Button
        ref={ref as any}
        data-active={isActive ? "" : data_active}
        {...props}
      >
        {children}
      </ChakraV3.Button>
    </ChakraV3.Menu.Trigger>
  ),
)
MenuButton.displayName = "MenuButton"

export const MenuList = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <ChakraV3.Portal>
      <ChakraV3.Menu.Positioner>
        <ChakraV3.Menu.Content ref={ref as any} {...props}>
          {children}
        </ChakraV3.Menu.Content>
      </ChakraV3.Menu.Positioner>
    </ChakraV3.Portal>
  ),
)
MenuList.displayName = "MenuList"

export const MenuItem = React.forwardRef<HTMLDivElement, any>(
  ({ children, onClick, ...props }, ref) => (
    <ChakraV3.Menu.Item
      ref={ref as any}
      value={props.value || ""}
      onSelect={onClick}
      {...props}
    >
      {children}
    </ChakraV3.Menu.Item>
  ),
)
MenuItem.displayName = "MenuItem"

export const MenuOptionGroup = ChakraV3.Menu.RadioItemGroup
export const MenuItemOption = ChakraV3.Menu.RadioItem
export const MenuDivider = ChakraV3.Menu.Separator

// ============================================================================
// ICONBUTTON COMPONENT ADAPTER
// ============================================================================

/**
 * IconButton v2 -> Button v3 adapter
 * Maps v2 icon prop to children
 */
export const IconButton = React.forwardRef<HTMLButtonElement, any>(
  (
    {
      icon,
      isDisabled,
      isLoading,
      isActive,
      colorScheme,
      disabled,
      loading,
      colorPalette,
      variant: variantProp,
      children,
      ...props
    },
    ref,
  ) => {
    let variant = variantProp
    if (variant === "primary") {
      variant = "solid"
    } else if (variant === "ghost") {
      variant = "plain"
    }

    return (
      <ChakraV3.IconButton
        ref={ref as any}
        disabled={isDisabled ?? disabled}
        loading={isLoading ?? loading}
        colorPalette={colorScheme ?? colorPalette}
        variant={variant}
        data-active={isActive ? "" : undefined}
        {...props}
      >
        {icon || children}
      </ChakraV3.IconButton>
    )
  },
)
IconButton.displayName = "IconButton"

// ============================================================================
// SWITCH COMPONENT ADAPTER
// ============================================================================

/**
 * Switch v2 -> Switch.Root v3 adapter
 */
export const Switch = React.forwardRef<HTMLInputElement, any>(
  (
    {
      isChecked,
      isDisabled,
      isInvalid,
      colorScheme,
      checked,
      disabled,
      invalid,
      colorPalette,
      children,
      ...props
    },
    ref,
  ) => (
    <ChakraV3.Switch.Root
      checked={isChecked ?? checked}
      disabled={isDisabled ?? disabled}
      invalid={isInvalid ?? invalid}
      colorPalette={colorScheme ?? colorPalette}
      {...props}
    >
      <ChakraV3.Switch.HiddenInput ref={ref as any} />
      <ChakraV3.Switch.Control>
        <ChakraV3.Switch.Thumb />
      </ChakraV3.Switch.Control>
      {children && <ChakraV3.Switch.Label>{children}</ChakraV3.Switch.Label>}
    </ChakraV3.Switch.Root>
  ),
)
Switch.displayName = "Switch"

// ============================================================================
// LIST COMPONENTS ADAPTERS
// ============================================================================

export const UnorderedList = (props: any) => (
  <ChakraV3.Stack as="ul" {...props} />
)
export const OrderedList = (props: any) => <ChakraV3.Stack as="ol" {...props} />
export const ListItem = (props: any) => <ChakraV3.Stack as="li" {...props} />

// ============================================================================
// COLLAPSE/COLLAPSIBLE ADAPTER
// ============================================================================

/**
 * Collapse v2 -> Collapsible v3 adapter
 * Maps v2 Collapse props to v3 Collapsible
 */
export const Collapse = React.forwardRef<HTMLDivElement, any>(
  ({ in: inProp, open: openProp, animateOpacity, children, ...props }, ref) => (
    <ChakraV3.Collapsible.Root
      ref={ref as any}
      open={inProp ?? openProp}
      {...props}
    >
      <ChakraV3.Collapsible.Content>{children}</ChakraV3.Collapsible.Content>
    </ChakraV3.Collapsible.Root>
  ),
)
Collapse.displayName = "Collapse"

// ============================================================================
// CARD COMPONENTS ADAPTERS
// ============================================================================

export const Card = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <ChakraV3.Card.Root ref={ref as any} {...props}>
      {children}
    </ChakraV3.Card.Root>
  ),
)
Card.displayName = "Card"

export const CardHeader = ChakraV3.Card.Header
export const CardBody = ChakraV3.Card.Body
export const CardFooter = ChakraV3.Card.Footer

// ============================================================================
// NUMBERINPUT COMPONENTS ADAPTERS
// ============================================================================

export const NumberInput = React.forwardRef<HTMLDivElement, any>(
  ({ children, ...props }, ref) => (
    <ChakraV3.NumberInput.Root ref={ref as any} {...props}>
      {children}
    </ChakraV3.NumberInput.Root>
  ),
)
NumberInput.displayName = "NumberInput"

export const NumberInputField = ChakraV3.NumberInput.Input
export const NumberInputStepper = ChakraV3.NumberInput.Control
export const NumberIncrementStepper = ChakraV3.NumberInput.IncrementTrigger
export const NumberDecrementStepper = ChakraV3.NumberInput.DecrementTrigger

// ============================================================================
// STACK COMPONENT ADAPTER
// ============================================================================

/**
 * Stack v2 -> Stack v3 adapter
 * Maps v2 spacing prop to v3 gap prop
 */
export const Stack = React.forwardRef<HTMLDivElement, any>(
  ({ spacing, divider, gap: gapProp, children, ...props }, ref) => (
    <ChakraV3.Stack ref={ref as any} gap={spacing ?? gapProp} {...props}>
      {divider
        ? // v2 style: insert divider between items
          React.Children.toArray(children).map((child, index, arr) => (
            <React.Fragment key={index}>
              {child}
              {index < arr.length - 1 && divider}
            </React.Fragment>
          ))
        : children}
    </ChakraV3.Stack>
  ),
)
Stack.displayName = "Stack"

// For convenience, also export HStack and VStack with spacing -> gap mapping
export const HStack = React.forwardRef<HTMLDivElement, any>(
  ({ spacing, gap, ...props }, ref) => (
    <ChakraV3.HStack ref={ref as any} gap={spacing ?? gap} {...props} />
  ),
)
HStack.displayName = "HStack"

export const VStack = React.forwardRef<HTMLDivElement, any>(
  ({ spacing, gap, ...props }, ref) => (
    <ChakraV3.VStack ref={ref as any} gap={spacing ?? gap} {...props} />
  ),
)
VStack.displayName = "VStack"

// ============================================================================
// HOOK ADAPTERS
// ============================================================================

/**
 * useToast hook v2 -> v3 adapter
 * v3 uses createToaster() in components/ui/toaster.tsx
 * For now, create a simple stub that logs to console
 */
export const useToast = () => {
  return (options: any) => {
    console.log("Toast:", options)
  }
}

/**
 * useColorMode hook v2 -> next-themes adapter
 * In v3, color mode is handled by next-themes
 * Create a stub that returns light/dark mode
 */
export const useColorMode = () => {
  // For now, return a dummy implementation
  // In production, integrate with next-themes' useTheme hook
  const [colorMode, setColorMode] = React.useState("light")
  return {
    colorMode,
    toggleColorMode: () => {
      setColorMode(colorMode === "light" ? "dark" : "light")
    },
    setColorMode,
  }
}

/**
 * useBoolean hook v2 -> v3 adapter
 * Can be used as:
 * - const { isOn, onToggle, onOpen, onClose } = useBoolean()  (object destructuring)
 * - const [value, setValue] = useBoolean() (array destructuring - v3 style)
 */
export const useBoolean = (initialValue?: boolean) => {
  const [value, setValue] = React.useState(initialValue ?? false)
  const result: any = [
    value,
    setValue,
    {
      isOn: value,
      onToggle: () => setValue(!value),
      onOpen: () => setValue(true),
      onClose: () => setValue(false),
      setValue,
    },
  ]
  // Make it destructurable as both array and object
  result.isOn = value
  result.onToggle = () => setValue(!value)
  result.onOpen = () => setValue(true)
  result.onClose = () => setValue(false)
  result.setValue = setValue
  return result
}

// ============================================================================
// ALERTDIALOG COMPONENTS ADAPTERS
// ============================================================================

/**
 * AlertDialog v2 -> Dialog v3 adapter
 * In v3, AlertDialog was removed. Use Dialog with role="alertdialog"
 */
// @ts-ignore - AlertDialog uses Dialog under the hood with different prop types
export const AlertDialog = React.forwardRef<HTMLDivElement, any>(
  (
    {
      isOpen,
      onClose,
      isCentered,
      closeOnOverlayClick = true,
      closeOnEsc = true,
      blockScrollOnMount = true,
      children,
      ...props
    },
    _ref, // Dialog.Root doesn't accept ref in v3
  ) => {
    const handleOpenChange = (e: any) => {
      if (!e.open) {
        onClose?.()
      }
    }

    // @ts-ignore - v3 Dialog.Root has different prop types
    return (
      <ChakraV3.Dialog.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        placement={isCentered ? "center" : "center"}
        closeOnInteractOutside={closeOnOverlayClick}
        closeOnEscape={closeOnEsc}
        preventScroll={blockScrollOnMount}
        {...props}
      >
        {children}
      </ChakraV3.Dialog.Root>
    )
  },
)
AlertDialog.displayName = "AlertDialog"

export const AlertDialogOverlay = ChakraV3.Dialog.Backdrop
export const AlertDialogContent = ChakraV3.Dialog.Content
export const AlertDialogHeader = ChakraV3.Dialog.Header
export const AlertDialogBody = ChakraV3.Dialog.Body
export const AlertDialogFooter = ChakraV3.Dialog.Footer
export const AlertDialogCloseButton = ChakraV3.Dialog.CloseTrigger
