// Copyright 2014 Google Inc. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var opener = window['opener'];
var mainWindow = window['mainWindow'];

closeButton.addEventListener('click', exit);
exportButton.addEventListener('click', exportSelectedFreqs);
importButton.addEventListener('click', importSelectedFreqs);
cancelImportButton.addEventListener('click', showCurrentEntries);

var presets = new Presets();
presets.load(showCurrentEntries);

function adjustWindow() {
  AuxWindows.resizeCurrentTo(700, 0);
}

function exit() {
  AuxWindows.closeCurrent();
}

function uniq(freqs) {
  var prev = null;
  for (var i = 0; i < freqs.length; ) {
    if (freqs[i] == prev) {
      freqs.splice(i, 1);
    } else {
      prev = freqs[i];
      ++i;
    }
  }
}

function showPresets(table, presets, delPresets, precheck) {
  var lines = table.getElementsByClassName('preset');
  while (lines.length > 0) {
    lines[0].parentElement.removeChild(lines[0]);
  }
  var freqs = [];
  if (presets) {
    for (var freq in presets.get()) {
      freqs.push(freq);
    }
  }
  if (delPresets) {
    for (var freq in delPresets.get()) {
      freqs.push(freq);
    }
  }
  freqs.sort(function(a,b) { return Number(a) - Number(b) });
  uniq(freqs);
  for (var i = 0; i < freqs.length; ++i) {
    var value = freqs[i];
    var preset = presets && presets.get(value);
    var delPreset = delPresets && delPresets.get(value);
    var isDouble = preset && delPreset;
    var line;
    if (delPreset) {
      line = makePresetLine(value, delPreset, i, true, isDouble, precheck);
      table.firstElementChild.appendChild(line);
    }
    if (preset) {
      line = makePresetLine(value, preset, i, false, isDouble, precheck);
      table.firstElementChild.appendChild(line);
    }
  }
  return freqs.length;
}

function makePresetLine(value, preset, index, isDelete, isDouble, precheck) {
  var isEven = 0 == (index % 2);
  var line = document.createElement('tr');
  if (isEven) {
    line.classList.add('evenRow');
  }
  if (isDelete) {
    line.classList.add('deleteRow');
  }
  line.classList.add('preset');
  if (isDelete || !isDouble) {
    line.appendChild(makeCheckboxCell(value, precheck, isDouble));
  }
  line.appendChild(makeFreqCell(preset));
  line.appendChild(makeNameCell(preset));
  line.appendChild(makeModeCell(preset));
  return line;
}

function makeCheckboxCell(value, precheck, isDouble) {
  var chk = document.createElement('input');
  chk.className = 'presetBox';
  chk.type = 'checkbox';
  chk.id = 'freq-' + value;
  chk.checked = precheck;
  var td = document.createElement('td');
  if (isDouble) {
    td.rowSpan = 2;
  }
  td.appendChild(chk);
  return td;
}

function makeFreqCell(preset) {
  var td = document.createElement('td');
  td.innerText = preset['display'].replace(' ', '\u00a0');
  return td;
}

function makeNameCell(preset) {
  var td = document.createElement('td');
  td.innerText = preset['name'].replace(' ', '\u00a0');
  td.style['font-weight'] = 700;
  return td;
}

function makeModeCell(preset) {
  var td = document.createElement('td');
  var band = preset['band'];
  var mode = preset['mode'];
  var text = '';
  if (band) {
    text = 'Band=' + band;
  } else {
    text = mode['modulation'];
    if (mode['bandwidth']) {
      text += '; bw=' + mode['bandwidth'] + 'Hz';
    }
    if (mode['maxF']) {
      text += '; maxF=' + mode['maxF'] + 'Hz';
    }
    if (mode['step']) {
      text += '; step=' + mode['step'] + 'Hz';
    }
    if (mode['upconvert']) {
      text += '; upconvert=on';
    }
  }
  td.appendChild(document.createTextNode(text));
  return td;
}

function getSelectedFreqs(container) {
  var freqBoxes = container.getElementsByClassName('presetBox');
  var selected = [];
  for (var i = 0; i < freqBoxes.length; ++i) {
    if (freqBoxes[i].checked) {
      selected.push(Number(freqBoxes[i].id.substring(5)));
    }
  }
  return selected;
}

function getSelectedEntries(container) {
  var selected = {};
  var freqs = getSelectedFreqs(container);
  for (var i = 0; i < freqBoxes.length; ++i) {
    selected[freqs[i]] = presets.get(freqs[i]);
  }
  return selected;
}

function exportSelectedFreqs() {
  var opt = {
    type: 'saveFile',
    suggestedName: 'presets.json'
  };
  chrome.fileSystem.chooseEntry(opt, function(fileEntry) {
    var entries = getSelectedEntries(showPresetPane);
    var exported = new Presets(entries).exportPresets();
    fileEntry.createWriter(function(writer) {
      writer.onwriteend = function() {
        if (this.position == 0) {
          writer.write(new Blob([JSON.stringify(exported)]));
        }
      };
      writer.truncate(0);
    });
  });
}

function importSelectedFreqs() {
  var opt = {
    type: 'openFile',
    accepts: [{
      description: 'JSON Files',
      extensions: ['json']}]
  };
  chrome.fileSystem.chooseEntry(opt, function(fileEntry) {
    fileEntry.file(function(file) {
      var reader = new FileReader();
      reader.onloadend = function() {
        var newPresets = JSON.parse(this.result);
        if (newPresets['presets']) {
          showImportedEntries(newPresets['presets']);
        }
      };
      reader.readAsText(file);
    });
  });
}

function showCurrentEntries() {
  showPresets(presetList, presets, null, true);
  showPresetPane.classList.remove('invisible');
  showDiffPane.classList.add('invisible');
  adjustWindow();
}

function showImportedEntries(entries) {
  var newPresets = new Presets();
  newPresets.importPresets(entries);
  var diff = presets.diff(newPresets);
  if (showPresets(addPresetList, diff.add, null, true)) {
    addPresetPanel.classList.remove('invisible');
  } else {
    addPresetPanel.classList.add('invisible');
  }
  if (showPresets(changePresetList, diff.changeAdd, diff.changeDel, false)) {
    changePresetPanel.classList.remove('invisible');
  } else {
    changePresetPanel.classList.add('invisible');
  }
  if (showPresets(deletePresetList, null, diff.del, false)) {
    delPresetPanel.classList.remove('invisible');
  } else {
    delPresetPanel.classList.add('invisible');
  }
  showPresetPane.classList.add('invisible');
  showDiffPane.classList.remove('invisible');
  doImportButton.addEventListener('click', performImport(diff));
  adjustWindow();
}

function performImport(diff) {
  return function() {
    var selectedFreqs = getSelectedFreqs(showDiffPane);
    var add = {};
    var del = {};
    for (var i = 0; i < selectedFreqs.length; ++i) {
      var freq = selectedFreqs[i];
      var toDel = diff.del.get(freq);
      var toAdd = diff.add.get(freq);
      if (toDel) {
        del[freq] = toDel;
      } else if (toAdd) {
        add[freq] = toAdd;
      } else {
        del[freq] = diff.changeDel.get(freq);
        add[freq] = diff.changeAdd.get(freq);
      }
    }
    presets.change(new Presets(del), new Presets(add));
    presets.save(function() {
      mainWindow.interface.updatePresets();
      exit();
    });
  }
}

