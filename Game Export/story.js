// Created with Squiffy 5.1.2
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '93b4c2beca';
squiffy.story.sections = {
	'_default': {
		'text': "<h6 id=\"testing\">Testing</h6>\n<hr>\n<h2 id=\"main-menu\">Main Menu</h2>\n<p><a class=\"squiffy-link link-section\" data-section=\"return\" role=\"link\" tabindex=\"0\">New game</a>\n<a class=\"squiffy-link link-section\" data-section=\"Scene Selection\" role=\"link\" tabindex=\"0\">Scene Selection</a></p>",
		'passages': {
		},
	},
	'Scene Selection': {
		'text': "<p><a class=\"squiffy-link link-section\" data-section=\"return\" role=\"link\" tabindex=\"0\">Start</a>\n<a class=\"squiffy-link link-section\" data-section=\"Walk through the gates\" role=\"link\" tabindex=\"0\">First day</a>\n<a class=\"squiffy-link link-section\" data-section=\"Go to dorm\" role=\"link\" tabindex=\"0\">Meeting Silence</a></p>",
		'passages': {
		},
	},
	'return': {
		'text': "<p>Do you wish to play as a <a class=\"squiffy-link link-section\" data-section=\"guy, gender=male\" role=\"link\" tabindex=\"0\">guy</a> or <a class=\"squiffy-link link-section\" data-section=\"girl, gender=female\" role=\"link\" tabindex=\"0\">girl</a>?</p>",
		'passages': {
		},
	},
	'guy': {
		'text': "<p>This is the way the game is meant to be played, and recommended for new players. Do you want to </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"continue\" role=\"link\" tabindex=\"0\">continue</a> or <a class=\"squiffy-link link-section\" data-section=\"return\" role=\"link\" tabindex=\"0\">return</a>?</p>",
		'passages': {
		},
	},
	'girl': {
		'text': "<p>Playing as a girl will change the storyline and is recommended for experienced players. Are you sure you want to continue?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"continue\" role=\"link\" tabindex=\"0\">continue</a> <a class=\"squiffy-link link-section\" data-section=\"return\" role=\"link\" tabindex=\"0\">return</a></p>",
		'passages': {
		},
	},
	'continue': {
		'clear': true,
		'text': "<p>A soft breeze {if gender=male:hits my neck.}{else:makes my hair wave around.}\nThe green leaves of the trees move around slowly, rustling softly.\nIt&#39;s late summer, which means that school just started again.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"to school\" role=\"link\" tabindex=\"0\">Continue</a></p>",
		'passages': {
		},
	},
	'to school': {
		'text': "<p>I slowly make my way to my new school, which lays about two kilometers from the nearby bus stop.</p>\n<p>Ah, I should introduce myself. My name&#39;s {if gender=male:Milo.}{else:Nicky}. I&#39;m 16 years old and study physics. Boring, I know, but my parents are forcing me to.</p>\n<p>I sigh as I see my school appear at the horizon. Leafwood High-school. The name is as bland as the building itself. Although it&#39;s quite modern, the white walls make it look boring.</p>\n<p>I stop at a crosswalk. The light is red.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Cross anyways\" role=\"link\" tabindex=\"0\">Cross anyways</a> <a class=\"squiffy-link link-section\" data-section=\"Wait\" role=\"link\" tabindex=\"0\">Wait</a></p>",
		'passages': {
		},
	},
	'Cross anyways': {
		'text': "<p>I quickly look left and right, before crossing the road.</p>\n<p>I soon arrive at the gates. Students are walking in from all directions.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Walk through the gates\" role=\"link\" tabindex=\"0\">Walk through the gates</a></p>",
		'passages': {
		},
	},
	'Wait': {
		'text': "<p>I wait at the crosswalk for half a minute, only for no cars to show up anyways. As the light finally turns green, I cross the road and continue walking to school.</p>\n<p>I soon arrive at the gates. Students are walking in from all directions.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Walk through the gates\" role=\"link\" tabindex=\"0\">Walk through the gates</a></p>",
		'passages': {
		},
	},
	'Walk through the gates': {
		'clear': true,
		'text': "<p>I walk though the gates, looking around at the environment. I&#39;m walking over a path that leads to the school&#39;s main entrance, with another path leading to the dormitory where I&#39;ll be staying.</p>\n<p>Around the path are small groups of students talking to eachother. I&#39;m honestly not really a social person. I usually spend my time alone, playing games or whatever. My parents thought that making me sleep in a dorm would make me able to concentrate more on school. But they didn&#39;t check my bag before I left the house this morning, so I was able to smuggle all sorts of stuff with me, like my laptop.</p>\n<p>As I near the main entrance, I feel my phone buzz in my pocket.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Read the notification\" role=\"link\" tabindex=\"0\">Read the notification</a> <a class=\"squiffy-link link-section\" data-section=\"Ignore it\" role=\"link\" tabindex=\"0\">Ignore it</a></p>",
		'attributes': ["score = 50"],
		'passages': {
		},
	},
	'Read the notification': {
		'text': "<p>I take out my phone and turn on the screen, only to see a text send by my mom.</p>\n<p>&quot;Have fun at school!&quot;</p>\n<p>Have fun...at school... Right.\nLike that&#39;s even possible.\nI take out my <a class=\"squiffy-link link-section\" data-section=\"timetable\" role=\"link\" tabindex=\"0\">timetable</a> to see where I have to go.</p>",
		'passages': {
		},
	},
	'Ignore it': {
		'text': "<p>I decide to ignore the notification for now.\nI take out my <a class=\"squiffy-link link-section\" data-section=\"timetable\" role=\"link\" tabindex=\"0\">timetable</a> to see where I have to go.</p>",
		'passages': {
		},
	},
	'timetable': {
		'text': "<table style=\"border-collapse:collapse;border-spacing:0\"><tr><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-section\" data-section=\"C103\" role=\"link\" tabindex=\"0\">C103</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A003</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C014</a><br></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">B105</a><br></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A105</a><br></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C103</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td></tr><tr><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C014</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A015</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">B105</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C015</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">B105</a></td></tr><tr><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A003</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A018</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C118</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C103</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A003</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A015</a></td></tr><tr><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C105</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">E002</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">E002</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C114</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C015</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A015</a><br></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C103</a></td></tr><tr><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A015</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A003</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">B105</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C110</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">C011</a></td><td style=\"font-family:Arial, sans-serif;font-size:14px;padding:10px 5px;border-style:solid;border-width:1px;overflow:hidden;word-break:normal;border-color:black;vertical-align:top\"><a class=\"squiffy-link link-passage\" data-passage=\"wrongclass\" role=\"link\" tabindex=\"0\">A015</a></td></tr></table>",
		'passages': {
			'wrongclass': {
				'text': "<p>That isn&#39;t my first period.</p>",
			},
		},
	},
	'C103': {
		'text': "<p>C103 seems to be my first class.\nI slowly make my way to the classroom while looking around, memorizing my way back here.\nAfter some time, I arrive at C103.\n<a class=\"squiffy-link link-section\" data-section=\"Enter the classroom\" role=\"link\" tabindex=\"0\">Enter the classroom</a></p>",
		'passages': {
		},
	},
	'Enter the classroom': {
		'clear': true,
		'text': "<p>I slowly make my way inside, looking around a bit.\nIt&#39;s a dull classroom. Only a few students are already sitting in small groups, talking to eachother.\nAfter a few minutes class starts. Apperantly it&#39;s history class. Like I wasn&#39;t tired enough already.\nI slowly feel like dozing off...\n<a class=\"squiffy-link link-section\" data-section=\"Sleep a bit\" role=\"link\" tabindex=\"0\">Sleep a bit</a> <a class=\"squiffy-link link-section\" data-section=\"Stay awake\" role=\"link\" tabindex=\"0\">Stay awake</a></p>",
		'passages': {
		},
	},
	'Sleep a bit': {
		'text': "<p>I rest my head on my arms and close my eyes. Slowly but surely, I doze off...</p>\n<p>&quot;{if gender=male:Milo,}{else:Nicky,} which God stole fire from the Gods and gave it to the humans?&quot;\nI jump up as I hear the question. The entire class is looking at me.\n&quot;E-ehm...&quot;\n<a class=\"squiffy-link link-section\" data-section=\"Icarus\" role=\"link\" tabindex=\"0\">Icarus</a>\n<a class=\"squiffy-link link-section\" data-section=\"Prometheus\" role=\"link\" tabindex=\"0\">Prometheus</a>\n<a class=\"squiffy-link link-section\" data-section=\"Atlas\" role=\"link\" tabindex=\"0\">Atlas</a></p>",
		'passages': {
		},
	},
	'Icarus': {
		'text': "<p>&quot;I-Icarus?&quot; I say hesitating.\n&quot;Prometheus, {if gender=male:Milo,}{else:Nicky,} it&#39;s Prometheus...&quot; the teacher says.\nThe entire class starts chuckling a bit. I can feel myself blushing.\nAfter that, the rest of the day goes by normally.</p>\n<p>The bell finally rings during the last period. I quickly grab my bag and walk outside.\n<a class=\"squiffy-link link-section\" data-section=\"Go to dorm\" role=\"link\" tabindex=\"0\">Go to dorm</a></p>",
		'attributes': ["score-=10"],
		'passages': {
		},
	},
	'Prometheus': {
		'text': "<p>&quot;P-Prometheus?&quot; I say hesitating.\n&quot;Prometheus, correct, {if gender=male:Milo.&quot;}{else:Nicky.&quot;}\nI sigh in relief.\nAfter that, the rest of the day goes by normally.</p>\n<p>The bell finally rings during the last period. I quickly grab my bag and walk outside.\n<a class=\"squiffy-link link-section\" data-section=\"Go to dorm\" role=\"link\" tabindex=\"0\">Go to dorm</a></p>",
		'attributes': ["score+=10"],
		'passages': {
		},
	},
	'Atlas': {
		'text': "<p>&quot;A-Atlas??&quot; I say hesitating.\n&quot;Prometheus, {if gender=male:Milo,}{else:Nicky,} it&#39;s Prometheus...&quot; the teacher says.\nThe entire class starts chuckling a bit. I can feel myself blushing.\nAfter that, the rest of the day goes by normally.</p>\n<p>The bell finally rings during the last period. I quickly grab my bag and walk outside.\n<a class=\"squiffy-link link-section\" data-section=\"Go to dorm\" role=\"link\" tabindex=\"0\">Go to dorm</a></p>",
		'attributes': ["score-=10"],
		'passages': {
		},
	},
	'Stay awake': {
		'text': "<p>I decide that sleeping during first class isn&#39;t apropriate.\nThe rest of the day goes by normally.\nThe bell finally rings during the last period. I quickly grab my bag and walk outside.\n<a class=\"squiffy-link link-section\" data-section=\"Go to dorm\" role=\"link\" tabindex=\"0\">Go to dorm</a></p>",
		'passages': {
		},
	},
	'Go to dorm': {
		'text': "<p>I make my way to the dormitory.\nAs I enter the quite modern building, I take out a letter I got during history class, which has my dorm number on it. Room 575. I like that number. Once I finally reach that stage, I enter my room. My bags have already been left on my bed. For some reason, the room is set up for two people. Weird, I made sure I selected &#39;single room&#39; on the registration form. Exhausted, I sit down on my bed. Should I <a class=\"squiffy-link link-section\" data-section=\"sleep\" role=\"link\" tabindex=\"0\">sleep</a> or <a class=\"squiffy-link link-section\" data-section=\"stay awake\" role=\"link\" tabindex=\"0\">stay awake</a>?</p>",
		'passages': {
		},
	},
	'sleep': {
		'clear': true,
		'text': "<p>I take off my shoes and lay down on my bed. I stare at the ceiling, before slowly falling asleep...\nAfter some time, I feel something pointy poking my face.\nAs I open my eyes, I can see a small girl poking my face with an envelope.\nI quickly sit up, looking at her.\nShe&#39;s about 1m50, or 4&quot;9, has long black hair that covers both her eyes, but is shorter on the left side, showing her mouth and nose. I can see her left eye slightly, but her right eye is completly covered by her hair.\n&quot;H-hello?&quot; I say to her, only to recieve a blank stare back. She keeps holding out the letter.\n<a class=\"squiffy-link link-section\" data-section=\"Take the letter\" role=\"link\" tabindex=\"0\">Take the letter</a></p>",
		'passages': {
		},
	},
	'Take the letter': {
		'text': "<p>I slowly take the envelope from her and notice the school&#39;s logo on it. As I take out the letter inside, the mysterious girl walks to the other bed, and sits down on it. <a class=\"squiffy-link link-passage\" data-passage=\"Read it\" role=\"link\" tabindex=\"0\">Read it</a> <a class=\"squiffy-link link-section\" data-section=\"Unfold the letter\" role=\"link\" tabindex=\"0\">Unfold the letter</a></p>",
		'passages': {
			'Read it': {
				'text': "<p>I should unfold the letter first.</p>",
			},
		},
	},
	'Unfold the letter': {
		'clear': true,
		'text': "<p>I unfold the letter and read it.</p>\n<h2 id=\"leafwood-high\">Leafwood High</h2>\n<h6 id=\"to-if-gender-male-milo-else-nicky-ross\">To: {if gender=male:Milo}{else:Nicky} Ross</h6>\n<hr>\n<p>Following the survey you&#39;ve entered when registering for our school, where you checked you would take care of a student with special needs, you&#39;ve been assigned a roommate. The roommate is your responsibility.</p>\n<p><em>The letter then goes on about unimportant stuff, aswel as the list of rules</em></p>\n<p>Weird, I don&#39;t remember entering a survey...\nI look up at the strange girl, who&#39;s playing on a handheld.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"*What's your name?*\" role=\"link\" tabindex=\"0\"><em>What&#39;s your name?</em></a> <a class=\"squiffy-link link-section\" data-section=\"Let her be\" role=\"link\" tabindex=\"0\">Ignore her</a></p>",
		'passages': {
		},
	},
	'stay awake': {
		'text': "<p>Even though I still feel sleepy, I decide to stay awake.</p>\n<p>After some time, I hear a few knocks on my door.\nI slowly get up and <a class=\"squiffy-link link-passage\" data-passage=\"open the door\" role=\"link\" tabindex=\"0\">open the door</a>.</p>",
		'passages': {
			'open the door': {
				'text': "<p>I open the door and look down at the small girl that&#39;s staring at me. She&#39;s about 1m50, or 4&quot;9, has long black hair that covers both her eyes, but is shorter on the left side, showing her mouth and nose. I can see her left eye slightly, but her right eye is completly covered by her hair.\n&quot;H-hello?&quot; I say to her, only to recieve a blank stare back.</p>\n<p>She holds up an envelope to me.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Take the letter\" role=\"link\" tabindex=\"0\">Take the letter</a></p>",
			},
		},
	},
	'*What\'s your name?*': {
		'text': "<p>&quot;What&#39;s your name?&quot; I ask, only to be ignored by her. She seems to only be intrested in her game, whatever she might be playing. I notice that she&#39;s wearing a pair of long black silk gloves.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Try getting her attention\" role=\"link\" tabindex=\"0\">Try getting her attention</a> <a class=\"squiffy-link link-section\" data-section=\"Just keep talking to her\" role=\"link\" tabindex=\"0\">Just keep talking to her</a> <a class=\"squiffy-link link-section\" data-section=\"Let her be\" role=\"link\" tabindex=\"0\">Let her be</a></p>",
		'passages': {
		},
	},
	'Try getting her attention': {
		'text': "<p>I grab my pillow and throw it at her.\nShe looks up for a moment, but remains silent.\n<a class=\"squiffy-link link-section\" data-section=\"*Fun game?*\" role=\"link\" tabindex=\"0\"><em>Fun game?</em></a> <a class=\"squiffy-link link-section\" data-section=\"Let her be\" role=\"link\" tabindex=\"0\">Let her be</a></p>",
		'passages': {
		},
	},
	'*Fun game?*': {
		'text': "<p>&quot;Fun game?&quot; I ask.\nShe gives a short nod and continues to play.\n&quot;Do you want something to drink?&quot;</p>\n<p>She shakes her head.\n<a class=\"squiffy-link link-section\" data-section=\"Thank her for responding\" role=\"link\" tabindex=\"0\">Thank her for responding</a> <a class=\"squiffy-link link-section\" data-section=\"Don't do anything\" role=\"link\" tabindex=\"0\">Don&#39;t do anything</a></p>",
		'passages': {
		},
	},
	'Thank her for responding': {
		'text': "",
		'passages': {
		},
	},
}
})();