<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { basicSetup } from 'codemirror';
  import { EditorView, keymap } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import { yaml } from '@codemirror/lang-yaml';
  import { indentWithTab } from '@codemirror/commands';
  import { history, historyKeymap } from '@codemirror/commands';
  
  export let isOpen = false;
  export let tool = '';
  export let name = '';
  export let content = '';
  export let filePath = '';
  
  let editorContainer: HTMLElement;
  let editorView: EditorView;
  let isSaving = false;
  let errorMessage = '';
  
  const dispatch = createEventDispatcher();
  
  // Custom keymap for the required shortcuts
  const customKeymap = [
    {
      key: 'Ctrl-Enter',
      run: () => {
        saveConfig();
        return true;
      }
    },
    {
      key: 'Ctrl-x',
      run: (view) => {
        const selection = view.state.selection;
        if (selection.ranges.some(range => !range.empty)) return false;
        
        // Get the current line
        const { from, to } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        const lineText = line.text;
        
        // Delete the line and move cursor to the start
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: '' },
          selection: { anchor: line.from }
        });
        
        // Copy the line to clipboard
        navigator.clipboard.writeText(lineText);
        
        return true;
      }
    },
    {
      key: 'Ctrl-c',
      run: (view) => {
        const selection = view.state.selection;
        if (selection.ranges.some(range => !range.empty)) return false;
        
        // Get the current line
        const { from } = view.state.selection.main;
        const line = view.state.doc.lineAt(from);
        
        // Copy the line to clipboard
        navigator.clipboard.writeText(line.text);
        
        // Move cursor to the start of the line
        view.dispatch({
          selection: { anchor: line.from }
        });
        
        return true;
      }
    }
  ];
  
  onMount(() => {
    if (isOpen) {
      initEditor();
    }
  });
  
  $: if (isOpen && editorContainer && !editorView) {
    initEditor();
  }
  
  function initEditor() {
    if (editorView) {
      editorView.destroy();
    }
    
    // Determine language extension based on tool
    const languageExtension = tool === 'hyc' ? yaml() : json();
    
    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        languageExtension,
        history(),
        keymap.of([
          ...historyKeymap,
          ...customKeymap,
          indentWithTab
        ])
      ]
    });
    
    editorView = new EditorView({
      state,
      parent: editorContainer
    });
  }
  
  function closeModal() {
    isOpen = false;
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
    dispatch('close');
  }
  
  async function saveConfig() {
    if (!editorView) return;
    
    isSaving = true;
    errorMessage = '';
    
    try {
      const updatedContent = editorView.state.doc.toString();
      
      // Save the file
      const saveResponse = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool,
          name,
          content: updatedContent
        })
      });
      
      if (!saveResponse.ok) {
        const errorText = await saveResponse.text();
        throw new Error(errorText);
      }
      
      // Restart the proxy
      const restartResponse = await fetch('/api/restart-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool,
          name
        })
      });
      
      if (!restartResponse.ok) {
        const errorText = await restartResponse.text();
        throw new Error(errorText);
      }
      
      // Close the modal after successful save and restart
      closeModal();
    } catch (error) {
      console.error('Error saving config:', error);
      errorMessage = error.message || 'An error occurred while saving the configuration';
    } finally {
      isSaving = false;
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-3/4 max-w-4xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-bold">Edit Configuration: {tool}@{name}</h2>
        <button 
          class="text-gray-500 hover:text-gray-700" 
          on:click={closeModal}
        >
          ✕
        </button>
      </div>
      
      <div class="text-sm text-gray-500 mb-2">
        File: {filePath}
      </div>
      
      <div class="flex-grow overflow-auto border border-gray-300 mb-4">
        <div bind:this={editorContainer} class="h-[60vh]"></div>
      </div>
      
      {#if errorMessage}
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      {/if}
      
      <div class="flex justify-end gap-2">
        <button 
          class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" 
          on:click={closeModal}
        >
          Cancel
        </button>
        <button 
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          on:click={saveConfig}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save and Restart (Ctrl+Enter)'}
        </button>
      </div>
      
      <div class="mt-2 text-sm text-gray-500">
        <p>Keyboard shortcuts:</p>
        <ul class="list-disc pl-5">
          <li>Ctrl+Z: Undo</li>
          <li>Ctrl+Shift+Z: Redo</li>
          <li>Ctrl+X (with no selection): Cut current line</li>
          <li>Ctrl+C (with no selection): Copy current line</li>
          <li>Ctrl+Enter: Save and restart</li>
        </ul>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.cm-editor) {
    height: 100%;
    font-family: monospace;
  }
  
  :global(.cm-scroller) {
    overflow: auto;
  }
</style>