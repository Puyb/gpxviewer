<html>
<body>
<ul>
<?php
    $l = glob('*.xml');
    sort($l);
    foreach($l as $f)
        echo '<li><a href="gpxviewer.html?file=' . $f . '">' . $f . '</a></li>';
?>
</ul>
</body>
</html>
