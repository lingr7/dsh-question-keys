window.__ModuleLoader__.load({
  id: 'dsh-question-keys',
  factory() {
    const PANEL = '[data-question-key]'
    const OPTION = '[data-option-row] button[role="radio"], [data-option-row] button[role="checkbox"]'
    const STYLE_ID = 'dsh-question-keys-style'

    const visible = element => {
      if (!(element instanceof HTMLElement)) return false
      if (element.closest('[inert], [hidden]') !== null) return false
      if (typeof element.checkVisibility === 'function') {
        return element.checkVisibility({ checkVisibilityCSS: true })
      }
      return true
    }

    const panel = () => {
      for (const element of document.querySelectorAll(PANEL)) {
        if (visible(element)) return element
      }
      return null
    }

    const options = scope => {
      const list = []
      for (const button of scope.querySelectorAll(OPTION)) {
        if (button.disabled !== true && visible(button)) list.push(button)
      }
      return list
    }

    const footerButtons = scope => {
      const footer = scope.querySelector('footer')
      if (footer === null) return []
      const list = []
      for (const button of footer.querySelectorAll('button')) {
        if (button.disabled !== true && visible(button)) list.push(button)
      }
      return list
    }

    const submitButton = scope => {
      const list = footerButtons(scope)
      return list.length === 0 ? null : list[list.length - 1]
    }

    const composer = () => {
      for (const element of document.querySelectorAll('[contenteditable="true"], [contenteditable="plaintext-only"]')) {
        if (visible(element)) return element
      }
      return null
    }

    const editable = target => {
      if (!(target instanceof Element)) return false
      if (target.closest('input, textarea, select') !== null) return true
      return target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null
    }

    const field = scope => {
      const element = scope.querySelector('textarea, input[type="text"]')
      return element !== null && visible(element) ? element : null
    }

    // Options first, then the free-text field as the last stop, so a remote can reach it too.
    const walk = scope => {
      const list = options(scope)
      const free = field(scope)
      if (list.length > 0 && free !== null) list.push(free)
      return list
    }

    const focusFirstOption = scope => {
      const list = options(scope)
      if (list.length > 0) {
        list[0].focus()
        return true
      }
      const free = field(scope)
      if (free !== null) {
        free.focus()
        return true
      }
      return false
    }

    const ensureRing = () => {
      if (document.getElementById(STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = [
        '[data-question-key] button:focus-visible,',
        '[data-approval-key] button:focus-visible,',
        '[data-plan-review-key] button:focus-visible {',
        '  outline: 2px solid var(--dsw-alias-interactive-primary, #4c8dff);',
        '  outline-offset: 2px;',
        '  border-radius: 8px;',
        '}',
        '[data-approval-key]:focus-visible,',
        '[data-question-key]:focus-visible,',
        '[data-plan-review-key]:focus-visible {',
        '  outline: 2px solid var(--dsw-alias-interactive-primary, #4c8dff);',
        '  outline-offset: -2px;',
        '  border-radius: 12px;',
        '}',
      ].join('\n')
      document.head.appendChild(style)
    }

    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => {
          ensureRing()

          let inside = false

          const onKeyDown = event => {
            const scope = panel()
            if (scope === null) return
            if (event.defaultPrevented) return
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
            if (event.isComposing === true || event.keyCode === 229) return

            const target = event.target instanceof Element ? event.target : null
            if (target === null) return

            const free = field(scope)
            if (editable(target)) {
              // Arrows belong to the caret, except in an empty free-text field where they can step back out.
              const empty = free !== null && target === free && String(free.value ?? '').trim() === ''
              const stepping = event.key === 'ArrowUp' || event.key === 'ArrowDown'
              if (!(empty && stepping)) return
            }

            if (event.key === 'Enter') {
              // The option button's own handler submits the whole flow; choosing is what a click does.
              if (target.closest(OPTION) !== null) {
                event.preventDefault()
                event.stopPropagation()
                target.closest(OPTION).click()
              }
              return
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              const list = walk(scope)
              if (list.length === 0) return
              event.preventDefault()
              event.stopPropagation()
              const at = list.indexOf(document.activeElement)
              const step = event.key === 'ArrowDown' ? 1 : -1
              const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length
              list[next].focus()
              return
            }

            if (event.key === 'ArrowRight') {
              const submit = submitButton(scope)
              if (submit === null) return
              event.preventDefault()
              event.stopPropagation()
              submit.focus()
              return
            }

            if (event.key === 'ArrowLeft') {
              const list = options(scope)
              if (list.length === 0) return
              event.preventDefault()
              event.stopPropagation()
              list[0].focus()
            }
          }

          const onFocusIn = () => {
            if (panel() !== null) inside = true
          }

          const settle = () => {
            const scope = panel()
            if (scope === null) {
              if (inside) {
                inside = false
                const field = composer()
                if (field !== null) field.focus()
              }
              return
            }
            inside = true
            if (scope.contains(document.activeElement)) return
            focusFirstOption(scope)
          }

          let timer = 0
          const schedule = () => {
            if (timer !== 0) return
            timer = setTimeout(() => {
              timer = 0
              try {
                settle()
              } catch (error) {
                console.warn('[dsh-question-keys] settle failed', error)
              }
            }, 40)
          }

          const observer = new MutationObserver(schedule)
          observer.observe(document.body, { childList: true, subtree: true })

          document.addEventListener('keydown', onKeyDown, true)
          document.addEventListener('focusin', onFocusIn)
          schedule()

          return () => {
            observer.disconnect()
            document.removeEventListener('keydown', onKeyDown, true)
            document.removeEventListener('focusin', onFocusIn)
            if (timer !== 0) clearTimeout(timer)
          }
        }, 'dsh-question-keys: option navigation')
      },
    }
  },
})
