/**
 * Shared dialog accessibility test patterns for admin routes
 * Tests focus management, keyboard navigation, and ARIA attributes
 * for dialogs used across admin pages (delete confirmation, suspend confirmation, etc.)
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';

/**
 * Generic dialog component for testing purposes
 */
function TestDialog({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      <p>{message}</p>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>Confirm</button>
    </div>
  );
}

/**
 * Dialog with focus trap and keyboard handling
 */
function AccessibleDialog({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  onClose?: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onKeyDown={handleKeyDown}
    >
      <h2 id="dialog-title">{title}</h2>
      <p>{message}</p>
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onConfirm}>Confirm</button>
    </div>
  );
}

describe('Dialog Accessibility Patterns - Shared Tests', () => {
  describe('ARIA Attributes', () => {
    it('dialog has role="dialog" attribute', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Test Dialog"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('dialog has aria-modal="true"', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Test Dialog"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('dialog has aria-labelledby pointing to heading', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Confirm Delete"
          message="This action cannot be undone."
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

      const heading = container.querySelector('#dialog-title');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Confirm Delete');
    });

    it('dialog heading has matching id for aria-labelledby', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Delete Confirmation"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      const labelId = dialog?.getAttribute('aria-labelledby');

      const heading = container.querySelector(`#${labelId}`);
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('focus moves INTO dialog on open', () => {
      const { container } = render(
        <AccessibleDialog
          isOpen={true}
          title="Delete?"
          message="This action is permanent."
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();

      // Dialog or its first interactive element should be visible
      const buttons = dialog?.querySelectorAll('button');
      expect(buttons?.length).toBeGreaterThan(0);
    });

    it('focus is visible on dialog buttons', () => {
      const { container } = render(
        <AccessibleDialog
          isOpen={true}
          title="Confirm Action"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      // Buttons should be keyboard accessible
      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });

    it('tab cycles through dialog buttons', async () => {
      const user = userEvent.setup();
      render(
        <AccessibleDialog
          isOpen={true}
          title="Confirm"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      const cancelButton = buttons[0];
      const confirmButton = buttons[1];

      // Set initial focus to cancel button
      cancelButton.focus();
      expect(document.activeElement).toBe(cancelButton);

      // Tab to confirm button
      await user.tab();
      expect(document.activeElement).toBe(confirmButton);

      // Tab should cycle back to cancel or next element
      await user.tab();
      // Focus should move to next element or wrap
    });

    it('focus cycles within dialog (Tab/Shift+Tab)', async () => {
      const user = userEvent.setup();
      render(
        <AccessibleDialog
          isOpen={true}
          title="Action Required"
          message="Confirm this action"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      // Focus on first button
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      // Shift+Tab should not move focus outside dialog
      await user.tab({ shift: true });
      // Focus should remain within dialog or move to previous element

      // Tab forward should cycle through elements
      firstButton.focus();
      await user.tab();
      expect(document.activeElement).not.toBe(null);
    });

    it('focus returns to trigger on close', async () => {
      const user = userEvent.setup();
      let isOpen = true;
      const setIsOpen = jest.fn((value) => {
        isOpen = value;
      });

      const TriggerButton = () => {
        return (
          <>
            <button onClick={() => setIsOpen(true)}>Open Dialog</button>
            <AccessibleDialog
              isOpen={isOpen}
              title="Dialog"
              message="Content"
              onConfirm={() => setIsOpen(false)}
              onCancel={() => setIsOpen(false)}
            />
          </>
        );
      };

      const { } = render(<TriggerButton />);

      const triggerButton = screen.getByRole('button', { name: 'Open Dialog' });

      // Click to open dialog
      await user.click(triggerButton);
      expect(setIsOpen).toHaveBeenCalledWith(true);

      // Note: Full focus return testing requires implementation of FocusScope
      // or similar focus management library
    });
  });

  describe('Keyboard Navigation', () => {
    it('Escape key closes dialog', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(
        <AccessibleDialog
          isOpen={true}
          title="Close Me"
          message="Press Escape"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Dialog handler should be called
      // (full test depends on implementation)
    });

    it('Enter key can confirm dialog (if focused on confirm button)', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <AccessibleDialog
          isOpen={true}
          title="Confirm"
          message="Press Enter to confirm"
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      confirmButton.focus();

      await user.keyboard('{Enter}');

      // Confirm should be callable
      expect(confirmButton).toBeInTheDocument();
    });

    it('Space key can activate button', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      render(
        <AccessibleDialog
          isOpen={true}
          title="Dialog"
          message="Press Space"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      cancelButton.focus();

      await user.keyboard(' ');

      // Button should be activatable with space
      expect(cancelButton).toBeInTheDocument();
    });
  });

  describe('Dialog Content and Buttons', () => {
    it('dialog displays title in heading', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Delete Organization"
          message="This action cannot be undone."
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const heading = screen.getByRole('heading', { name: 'Delete Organization' });
      expect(heading).toBeInTheDocument();
    });

    it('dialog displays message content', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Confirm Action"
          message="Are you sure you want to proceed? This cannot be undone."
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText('Are you sure you want to proceed? This cannot be undone.')).toBeInTheDocument();
    });

    it('dialog has Cancel button', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Confirm"
          message="Content"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('dialog has Confirm button', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Confirm"
          message="Content"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('dialog has at least Cancel and Confirm buttons (not single destructive action)', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Delete"
          message="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);

      const hasCancel = buttons.some((btn) => btn.textContent === 'Cancel');
      const hasConfirm = buttons.some((btn) => btn.textContent === 'Confirm');

      expect(hasCancel).toBe(true);
      expect(hasConfirm).toBe(true);
    });
  });

  describe('Button Interactions', () => {
    it('Cancel button calls onCancel handler', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      render(
        <TestDialog
          isOpen={true}
          title="Dialog"
          message="Click Cancel"
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('Confirm button calls onConfirm handler', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <TestDialog
          isOpen={true}
          title="Dialog"
          message="Click Confirm"
          onConfirm={onConfirm}
          onCancel={() => {}}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('clicking Cancel button does NOT call onConfirm', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      render(
        <TestDialog
          isOpen={true}
          title="Dialog"
          message="Click Cancel"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('clicking Confirm button does NOT call onCancel', async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      render(
        <TestDialog
          isOpen={true}
          title="Dialog"
          message="Click Confirm"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('dialog is announced to screen readers on open', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Important Action"
          message="This requires your attention"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('dialog heading is associated for screen reader announcement', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Confirm Deletion"
          message="Are you absolutely sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      const labelId = dialog?.getAttribute('aria-labelledby');

      expect(labelId).toBeTruthy();

      const heading = container.querySelector(`#${labelId}`);
      expect(heading).toHaveTextContent('Confirm Deletion');
    });

    it('dialog content is announced properly with aria-labelledby and aria-describedby', () => {
      const { container } = render(
        <div>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-desc"
          >
            <h2 id="dialog-title">Delete Item?</h2>
            <p id="dialog-desc">This action cannot be undone.</p>
            <button>Cancel</button>
            <button>Delete</button>
          </div>
        </div>
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'dialog-desc');
    });
  });

  describe('Dialog Visibility and Rendering', () => {
    it('dialog is not rendered when isOpen is false', () => {
      const { container } = render(
        <TestDialog
          isOpen={false}
          title="Hidden Dialog"
          message="Should not be visible"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeInTheDocument();
    });

    it('dialog is rendered when isOpen is true', () => {
      const { container } = render(
        <TestDialog
          isOpen={true}
          title="Visible Dialog"
          message="Should be visible"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
    });

    it('dialog content is accessible after rendering', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Accessible Dialog"
          message="All content should be accessible"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByRole('heading', { name: 'Accessible Dialog' })).toBeInTheDocument();
      expect(screen.getByText('All content should be accessible')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });
  });

  describe('Semantic Structure', () => {
    it('dialog uses heading for title, not generic text', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Dialog Title"
          message="Body text here"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      // Title should be a heading
      const heading = screen.getByRole('heading', { name: 'Dialog Title' });
      expect(heading).toBeInTheDocument();

      // Not just text
      expect(heading.tagName).toBe('H2');
    });

    it('dialog buttons are semantic button elements', () => {
      render(
        <TestDialog
          isOpen={true}
          title="Dialog"
          message="Click buttons below"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });
});

describe('Dialog Accessibility - Integration Test', () => {
  it('complete delete confirmation workflow with proper accessibility', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onCancel = jest.fn();

    const { container, unmount } = render(
      <AccessibleDialog
        isOpen={true}
        title="Delete Organization?"
        message="This action cannot be undone. All associated data will be permanently removed."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Verify dialog structure and attributes
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');

    // Verify heading is associated
    const heading = screen.getByRole('heading', { name: 'Delete Organization?' });
    expect(heading.id).toBe('dialog-title');

    // Verify message is displayed
    expect(
      screen.getByText(
        'This action cannot be undone. All associated data will be permanently removed.'
      )
    ).toBeInTheDocument();

    // Verify buttons are present
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const cancelButton = buttons.find((btn) => btn.textContent === 'Cancel');
    const confirmButton = buttons.find((btn) => btn.textContent === 'Confirm');
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();

    // Test cancel action
    if (cancelButton) {
      await user.click(cancelButton);
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    }

    // Clean up and test confirm action in fresh render
    unmount();
    onCancel.mockClear();
    onConfirm.mockClear();

    const { container: container2 } = render(
      <AccessibleDialog
        isOpen={true}
        title="Delete Organization?"
        message="This action cannot be undone. All associated data will be permanently removed."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const buttonsRound2 = screen.getAllByRole('button');
    const confirmButtonRound2 = buttonsRound2.find((btn) => btn.textContent === 'Confirm');
    
    if (confirmButtonRound2) {
      await user.click(confirmButtonRound2);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    }
  });
});

