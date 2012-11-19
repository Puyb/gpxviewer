var heartrate_max = 220 - 30; // 220 - age
var heartrate_zones = [.9, .8, .7, .6, 0]
var pause_speed = 6;
var mode = 'time';
var graph_height = 100;
var graduation_min_width = 30;
var $ = function(id) { return document.getElementById(id); };

function distance(lat1, lon1, lat2, lon2, unit) {
    var radlat1 = Math.PI * lat1/180
    var radlat2 = Math.PI * lat2/180
    var radlon1 = Math.PI * lon1/180
    var radlon2 = Math.PI * lon2/180
    var theta = lon1-lon2
    var radtheta = Math.PI * theta/180
    var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
    dist = Math.acos(dist)
    dist = dist * 180/Math.PI
    dist = dist * 60 * 1.1515
    if(!unit) unit = 'M';
    if (unit=="M") { dist = dist * 1609.344 }
    if (unit=="N") { dist = dist * 0.8684 }
    return dist || 0;
}

function load() {
    map = new GMap2($("map"));
    map.addControl(new GLargeMapControl());
    map.addControl(new GMapTypeControl());



    var args = {};
    location.href.split('?').slice(1).join('?').split('&').forEach(function(s) {
        args[decodeURIComponent(s.split('=')[0])] = decodeURIComponent(s.split('=').slice(1).join('='));
    });
    if(args.start)
        args.start = new Date(args.start).getTime();
    if(args.end)
        args.end = new Date(args.end).getTime();
    var request = GXmlHttp.create();
    request.open("GET", args.file, true);
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            // data
            parseGPX(request.responseXML, args.file, args);
        }
    }
    request.send(null);
}

function parseGPX(xml, filename, args) {
    var prefix = /Chrome/.test(navigator.userAgent) ? '' : 'gpxdata:';

    var points = [];
    var min_lat, max_lat, min_lng, max_lng;
    var distance_total = 0;
    var trkpts = xml.documentElement.getElementsByTagName('trkpt');
    for(var i = 0; i < trkpts.length; i++) {
        var trkpt = trkpts[i];
        var time = new Date(trkpt.getElementsByTagName('time')[0].textContent).getTime();
        if(args.start && time <= args.start) continue;
        if(args.end   && time >= args.end)   continue;

        var d = {
            time: time,
            lat: parseFloat(trkpt.getAttribute('lat')),
            lng: parseFloat(trkpt.getAttribute('lon')),
        }
        points.push(d);

        if(!min_lat || min_lat > d.lat) min_lat = d.lat;
        if(!max_lat || max_lat < d.lat) max_lat = d.lat;
        if(!min_lng || min_lng > d.lng) min_lng = d.lng;
        if(!max_lng || max_lng < d.lng) max_lng = d.lng;
        
        d.elevation = parseFloat(trkpt.getElementsByTagName('ele')[0].textContent)
        if(d.elevation > 32768) d.elevation = 65535 - d.elevation;

        d.heartrate = parseFloat(trkpt.getElementsByTagName(prefix + 'hr')[0].textContent)
        d.speed = parseFloat(trkpt.getElementsByTagName(prefix + 'speed')[0].textContent)
        if(typeof min_speed == 'undefined' || min_speed > d.speed) min_speed = d.speed;
        if(typeof max_speed == 'undefined' || max_speed < d.speed) max_speed = d.speed;
    }
    points = points.sort(function(a, b) { return a.time - b.time; });
        /*
    var a = points[0][1][0];
    var b = points[0][1][1];
    var t = points[0][0];
    var s = 0;
    var discard = 0;
    for(var i = 1; i < points.length; i++) {
        if(t == points[i][0]) continue;
        var d = distance(a, b, points[i][1][0], points[i][1][1]);
        var speed = d / (points[i][0] - t) * 1000 * 3600;
        var acceleration = (speed - s) * 1000 / 3600 / (points[i][0] - t) * 1000;

        speed = Math.round(speed * 100) / 100;
        if(typeof min_speed == 'undefined' || min_speed > speed) min_speed = speed;
        if(typeof max_speed == 'undefined' || max_speed < speed) max_speed = speed;
        speeds.push([t, speed]);

        acceleration = Math.round(acceleration * 100) / 100;
        if(typeof min_acceleration == 'undefined' || min_acceleration > acceleration) min_acceleration = acceleration;
        if(typeof max_acceleration == 'undefined' || max_acceleration < acceleration) max_acceleration = acceleration;
        accelerations.push([t, acceleration]);

        if(Math.abs(acceleration) > 5) { // erreur GPS
            discard++;
            points.splice(i, 1);
            speeds.splice(-2, 1);
            accelerations.pop();
        }
        
        t = points[i][0];
        a = points[i][1][0];
        b = points[i][1][1];
        s = speed;
    }
    */
    var distance_total = 0;
    points[0].distance = 0;
    points[0].grade = 0;
    for(var i = 1; i < points.length; i++) {
        var d = distance(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng) || 0;
        distance_total += d;
        points[i].distance = distance_total;
        points[i].grade = (points[i].elevation - points[i - 1].elevation) / d;
    }

    var pause = 0;
    var t = points[0].time;
    for(var i = 1; i < points.length; i++) {
        if(points[i].speed < pause_speed) { // pause
            pause += points[i].time - points[i -1].time;
        } else { // activité

        }
    }
    var duration_total = points[points.length - 1].time - points[0].time;

    var heartrate_durations = {};
    heartrate_zones.forEach(function(i) {
        heartrate_durations[i] = 0;
    });
    for(var i = 1; i < points.length; i++) {
        for(var j = 0; j < heartrate_zones.length; j++)
            if(points[i].heartrate >= Math.round(heartrate_zones[j] * heartrate_max)) {
                heartrate_durations[heartrate_zones[j]] += points[i].time - points[i - 1].time;
                break;
            }
    }

    var calories = 0;
    var nodes = xml.documentElement.getElementsByTagName(prefix + 'calories');
    for(var i = 0; i < nodes.length; i++)
        calories += parseFloat(nodes[i].textContent);

    $('info_general').innerHTML = '<table><tr><th>File :</th><td>' + filename + '</td></tr>' +
        '<tr><th>Distance :</th><td>' + Math.round(distance_total / 10) / 100 + 'km</td></tr>' +
        '<tr><th>Points :</th><td>' + trkpts.length + '</td></tr>' +
        '<tr><th>Duration :</th><td>' + showTime(duration_total, true) + '</td></tr>' +
        '<tr><th>Pauses (< 7 km/h) :</th><td>' + showTime(pause, true) + ' (' + Math.round(pause / duration_total * 100) + '%)</td></tr>' +
        '<tr><th>Average speed :</th><td>' + Math.round(distance_total / duration_total * 3600 * 100) / 100 + ' km/h</td></tr>' +
        '<tr><th>(without pauses) :</th><td>' + Math.round(distance_total / (duration_total - pause) * 3600 * 100) / 100 + ' km/h</td></tr>' +
        // FIXME: test if heartrate
        (points.length ? heartrate_zones.map(function(i) {
            return '<tr><th>Heartrates > ' + i * 100 + '% (' + Math.round(i * heartrate_max) + ') :</th><td>' + showTime(heartrate_durations[i], true) + ' (' + Math.round(heartrate_durations[i] / duration_total * 100) + '%)';
        }).join('</td></tr>') : '') +
        '<tr><th>Calories :</th><td>' + calories + '</td></tr></table>';

    // display

    var bounds = new GLatLngBounds(new GLatLng(min_lat, min_lng), new GLatLng(max_lat, max_lng));
    map.setCenter(new GLatLng((max_lat + min_lat) / 2, (max_lng + min_lng) / 2), map.getBoundsZoomLevel(bounds), G_NORMAL_MAP);

    var polyline = points.map(function(i) { return new GLatLng(i.lat, i.lng); });
    heartrate_durations[heartrate_max] = 0;
    map.addOverlay(new GPolyline(polyline, '#ff0000', 5));
    var marker = new GMarker(polyline[0]);
    map.addOverlay(marker);

    var canvas = $('graphs');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    var ctx = canvas.getContext('2d');
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'bevel';
    function textRight(txt, x, y) {
        ctx.fillText(txt, x - ctx.measureText(txt).width, y);
    }

    function textCenter(txt, x, y) {
        ctx.fillText(txt, x - ctx.measureText(txt).width / 2, y);
    }

    function textCenterVertical(txt, x, y) {
        ctx.save();
        ctx.translate(x, y)
        ctx.rotate(-Math.PI / 2);
        //ctx.fillText(txt, 0, 10);
        ctx.fillText(txt, -ctx.measureText(txt).width / 2, 10);
        ctx.restore();
    }

    function draw_graph(dataset, graph_top, draw_zones, draw_grades) {
        var min, max;
        for(var i = 0; i < plot.length; i++)
            if(start <= plot[i][mode] && plot[i][mode] <= end) {
                if(typeof min == 'undefined' || plot[i][dataset] < min) min = plot[i][dataset];
                if(typeof max == 'undefined' || plot[i][dataset] > max) max = plot[i][dataset];
            }
        function getY(e) { return Math.floor(graph_top + 5 + graph_height - (e[dataset] - min) / (max - min) * graph_height); }

        if(draw_zones) {
            ctx.save();
            for(var i = 0; i < heartrate_zones.length; i++) {
                var y1 = Math.round(getY({ time: 0, distance: 0, heartrate: heartrate_zones[i] * heartrate_max }));
                var y2 = Math.round(getY({ time: 0, distance: 0, heartrate: (i == 0 ? 1 : heartrate_zones[i - 1]) * heartrate_max }));
                if(y1 < graph_top + 5) continue;
                if(y2 > graph_top + 5 + graph_height) continue;
                if(y2 < graph_top + 5) y2 = graph_top + 5;
                if(y1 > graph_top + 5 + graph_height) y1 = graph_top + 5 + graph_height;
                
                var k = ('0' + Math.round(255 - (heartrate_zones[i] - .5) * 2 * 255).toString(16)).slice(-2);
                ctx.fillStyle = '#ff' + k + k;

                ctx.fillRect(graph_left + 50, y1, graph_width - 50, y2 - y1);
                ctx.fillStyle = 'black';
                if(graph_top + 15 < y1 && y1 < graph_top + 5 + graph_height)
                    textRight(heartrate_zones[i] * heartrate_max, graph_left + 48, y1 + 5);
            }
            ctx.restore();
        }
        if(draw_grades) {
            for(var i = 0; i < plot.length; i++) {
                var grade = Math.abs(plot[i].grade);
                if(draw_grades && i && grade >= .05) {
                    ctx.save();
                    if(      grade >= .15 ) ctx.fillStyle = '#ff0000';
                    else if( grade >= .12 ) ctx.fillStyle = '#ff3333';
                    else if( grade >= .10 ) ctx.fillStyle = '#ff6666';
                    else if( grade >= .07 ) ctx.fillStyle = '#ff9999';
                    else if( grade >= .05 ) ctx.fillStyle = '#ffcccc';

                    ctx.fillRect(plot[i - 1].x, graph_top + 5, plot[i - 1].x - plot[i].x, graph_height);
                    ctx.restore();
                }
            }
        }
        // Draw graduations
        (function() {
            // Find number of graduations
            var number = Math.floor((graph_width - 50) / graduation_min_width);
            // Find time or distance interval
            var inter = 0;
            var inter_min = (end - start) / number;
            if(mode == 'distance') {
                // distance = 1, 2, 5 * 10^n
                var power = String(Math.ceil(inter_min)).length - 1;
                var units = [1, 2, 5, 10];
                while((inter = Math.pow(10, power) * units.shift()) < inter_min);
            } else {
                // time = 5, 15, 30 sec, min or 1, 2, 3 * 10^n
                if(inter_min < 30 * 60 * 1000) {
                    var units = [2, 5, 15, 30, 5 * 60, 15 * 60, 30 * 60];
                    while((inter = units.shift() * 1000) < inter_min);
                } else {
                    var power = String(Math.ceil(inter_min / 3600 / 1000)).length;
                    var units = [1, 2, 5];
                    while((inter = Math.pow(10, power) * units.shift() * 3600 * 1000) < inter_min);
                }
            }
            // draw
            ctx.save();
            var show = mode == 'time' ? showTime : showDistance;
            var x0 = -1;
            for(var i = Math.ceil((plot[0][mode]) / inter) * inter; i < end - plot[0][mode]; i += inter) {
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                ctx.beginPath();
                var x = getX({time: plot[0][mode] + i, distance: plot[0][mode] + i});
                if(!~x0) x0 = x;
                ctx.moveTo(x, graph_top + 5);
                ctx.lineTo(x, graph_top + 5 + graph_height);
                ctx.stroke();
                textCenter(show(i), x, graph_top + 5 + graph_height + 12);
            }
            if(x0 - 50 > graduation_min_width / 2)
                textCenter(show(plot[0][mode]), graph_left + 50, graph_top + 5 + graph_height + 12);
            if(graph_width - 50 - x > graduation_min_width / 2)
                textCenter(show(end - plot[0][mode]), graph_left + graph_width, graph_top + 5 + graph_height + 12);
            ctx.restore();
        })();
        // Draw graph
        ctx.beginPath();
        for(var i = 0; i < plot.length; i++) {
            ctx[i ? 'lineTo' : 'moveTo'](plot[i].x, getY(plot[i]));
        }
        ctx.stroke();

        // draw scales
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(graph_left + 50, graph_top + 5);
        ctx.lineTo(graph_left + 50, graph_top + 5 + graph_height);
        ctx.lineTo(graph_left + graph_width, graph_top + 5 + graph_height);
        ctx.stroke();
        
        // text labels
        if(dataset == 'speed') {
            max = Math.round(max * 100) / 100;
            min = Math.round(min * 100) / 100;
        } else {
            max = Math.round(max);
            min = Math.round(min);
        }
        textRight(max, graph_left + 48, graph_top + 10);
        textRight(min, graph_left + 48, graph_top + 10 + graph_height );

        
    }
    function showTime(s, seconds) {
        s /= 1000;
        return Math.floor(s / 3600) + ":" + ("00" + Math.floor(s % 3600 / 60)).slice(-2) + (seconds ? ":" + ("00" + Math.floor(s % 60)).slice(-2) : "");
    }
    function showDistance(d, unit) {
        // FIXME: support interval to show consistent distances
        // FIXME : support sub graduations
        unit = unit ? ' km' : '';
        if(d > 10000) return Math.round(d / 1000) + unit;
        if(d > 5000) return Math.round(d / 100) / 10 + unit;
        return Math.round(d / 10) / 100 + unit;
    }

    var image;
    var start = points[0].time, end = points[points.length - 1].time;
    var plot = [];
    var graph_left = 0, graph_width = canvas.width - 10;
    function getX(e) { return Math.floor(graph_left + 50 + (e[mode] - start) / (end - start) * (graph_width - 50)); }
    function draw_graphs() {
        // simplify graphs
        plot = [];
        var d = { elevation: 0, heartrate: 0, speed: 0, grade: 0 };
        var count = 0;
        var current_X = getX({ time: start, distance: start });
        for(var i = 0; i < points.length; i++)
            if(start <= points[i][mode] && points[i][mode] <= end) {
                if( getX(points[i]) >= current_X + 1) {
                    for(var k in d)
                        d[k] /= count;
                    for(var k in points[i])
                        if(!d.hasOwnProperty(k))
                            d[k] = points[i][k];
                    d.x = current_X;
                    plot.push(d);
                    d = { point: i, elevation: 0, heartrate: 0, speed: 0, grade: 0 };
                    current_X = getX(points[i]);
                    count = 0;
                }
                for(var k in d)
                    if(typeof points[i][k] != 'undefined')
                        d[k] += points[i][k];
                count++;
            }
        for(var k in d)
            d[k] /= count;
        for(var k in points[i])
            if(!d.hasOwnProperty(k))
                d[k] = points[i][k];
        d.x = current_X;
        plot.push(d);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        //ctx.strokeStyle = 'black';
        //ctx.lineWidth = 1;

        textCenterVertical('Elevation', 0, 55);
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        draw_graph('elevation', 5, false, true);
        //if(heartrates.length) {
        if(1) {
            textCenterVertical('Heartrate', 0, 185);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1.5;
            draw_graph('heartrate', 135, true);
        }
        textCenterVertical('Speed', 0, 315);
        ctx.strokeStyle = 'green';
        ctx.lineWidth = 2;
        draw_graph('speed', 265);
        // textCenterVertical('Acceleration', 0, 440);
        // ctx.strokeStyle = 'brown';
        // ctx.lineWidth = 2;
        // draw_graph(accelerations, start, end, 0, 390, canvas.width - 10, 100, showTime, null);

        image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    draw_graphs();

    var canvas_left = 0;
    var e = canvas;
    while(e != document) {
        canvas_left += e.offsetLeft || 0;
        e = e.parentNode;
    }
    canvas.addEventListener('mousemove', function(event) {
        var x = event.clientX - canvas_left - 50;
        if(x < 0 || x > canvas.offsetWidth - 50 - 10) return;

        ctx.putImageData(image, 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#6666ff';
        ctx.beginPath();
        ctx.moveTo(50 + x,   5 + 5 + 5);
        ctx.lineTo(50 + x,   5 + 5 + 100);
        ctx.moveTo(50 + x, 135 + 5 + 5);
        ctx.lineTo(50 + x, 135 + 5 + 100);
        ctx.moveTo(50 + x, 265 + 5 + 5);
        ctx.lineTo(50 + x, 265 + 5 + 100);
        ctx.stroke();

        var t = start + x / (canvas.offsetWidth - 50 - 10) * (end - start);
        var i = 1;
        var d = 0;
        while(i < plot.length && plot[i][mode] < t) {
            if(i > 0) d += distance(plot[i - 1].lat, plot[i - 1].lng, plot[i].lat, plot[i].lng);
            i++;
        }
        if(i >= plot.length) return;
        if(plot[i][mode] - t > t - plot[i - 1][mode]) i--;

        marker.setLatLng(new GLatLng(plot[i].lat, plot[i].lng));

        
        $("infos").innerHTML = "<table>" +
            "<tr><th>Point :</th><td>" + d.point + "</th><td></td></tr>" + 
            "<tr><th>Distance :</th><td>" + showDistance(d, true) + "</td></tr>" +
            "<tr><th>Time :</th><td>" + showTime(t - plot[0].time, true) + "</td></tr>" +
            "<tr><th>Date :</th><td>" + new Date(t) + "</td></tr>" + 
            "<tr><th>Coordonnées :</th><td>" + plot[i].lat + ', ' + plot[i].lng + "</td></tr>" +
            "<tr><th>Elevation :</th><td>" + Math.round(plot[i].elevation) + " m</td></tr>" + 
            ( plot[i].heartrate ? "<tr><th>Heartrate :</th><td>" + Math.round(plot[i].heartrate) + " bpm</td></tr>" : '') +
            "<tr><th>Speed :</th><td>" + (Math.round(plot[i].speed * 100) / 100) + " km/h</td></tr>" +
            "<tr><th>Grade :</th><td>" + Math.round(plot[i].grade * 100) + " %</td></tr>" +
            //"<tr><th>Acceleration :</th><td>" + accelerations[k][1] + " m/s²</td></tr>" +
            "</table>";



    }, false);
    canvas.addEventListener('click', function(event) {
        var x = event.clientX - canvas_left - 50;
        if(x < 0 || x > canvas.offsetWidth - 50 - 10) return;

        var t = start + x / (canvas.offsetWidth - 50 - 10) * (end - start);

        var plage = end - start;

        if(!event.shiftKey) {
            plage /= 2;
            start = t - plage / 2;
            if(start < plot[0][mode]) start = plot[0][mode];
            end = start + plage;
            if(end >= plot[plot.length - 1][mode]) {
                end = plot[plot.length - 1][mode];
                start = end - plage;
            }
        } else {
            plage *= 2;
            start = t - plage / 2;
            if(start < plot[0][mode]) start = plot[0][mode];
            end = start + plage;
            if(end >= plot[plot.length - 1][mode]) end = plot[plot.length - 1][mode];
        }
        var min_lat, max_lat, min_lng, max_lng;
        for(var i = 0; i < plot.length; i++)
            if(start <= plot[i][mode] && plot[i][mode] <= end) {
                if(!min_lat || min_lat > plot[i].lat) min_lat = plot[i].lat;
                if(!max_lat || max_lat < plot[i].lat) max_lat = plot[i].lat;
                if(!min_lng || min_lng > plot[i].lng) min_lng = plot[i].lng;
                if(!max_lng || max_lng < plot[i].lng) max_lng = plot[i].lng;
            }
        var bounds = new GLatLngBounds(new GLatLng(min_lat, min_lng), new GLatLng(max_lat, max_lng));
        map.setCenter(new GLatLng((max_lat + min_lat) / 2, (max_lng + min_lng) / 2), map.getBoundsZoomLevel(bounds), G_NORMAL_MAP);

        draw_graphs();
    }, false);

    $('mode').addEventListener('change', function(event) {
        mode = $('mode').value;

        start = points[0][mode];
        end = points[points.length - 1][mode];

        draw_graphs();
    });


}

